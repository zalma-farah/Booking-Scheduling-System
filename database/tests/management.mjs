import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const base=fileURLToPath(new URL('../..', import.meta.url));
const db=new PGlite({extensions:{btree_gist}});
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
for(const file of ['database/schema.sql','database/migrations/001_resource_availability.sql','database/migrations/002_booking_rules.sql','database/migrations/003_organization_access.sql','database/migrations/004_managed_operations.sql','database/migrations/005_safe_inventory_deletion.sql','database/migrations/006_room_kiosk_status.sql']){
  await db.exec(fs.readFileSync(base+'/'+file,'utf8'));console.log('APPLIED '+file);
}
await db.exec(`INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-0000-0000-000000000001','sdsu@example.invalid'),
 ('00000000-0000-0000-0000-000000000002','ucsd@example.invalid'),
 ('00000000-0000-0000-0000-000000000003','user@example.invalid'),
 ('00000000-0000-0000-0000-000000000004','unassigned@example.invalid'),
 ('00000000-0000-0000-0000-000000000005','other@example.invalid');
UPDATE public.profiles SET role='administrator' WHERE id IN ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004');
INSERT INTO public.organization_admins(user_id,organization_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM public.organizations WHERE code='SDSU';
INSERT INTO public.organization_admins(user_id,organization_id)
SELECT '00000000-0000-0000-0000-000000000002', id FROM public.organizations WHERE code='UCSD';
INSERT INTO public.locations(id,name,organization_id) SELECT 11,'SDSU',id FROM public.organizations WHERE code='SDSU';
INSERT INTO public.locations(id,name,organization_id) SELECT 12,'UCSD',id FROM public.organizations WHERE code='UCSD';
INSERT INTO public.resources(id,location_id,name) VALUES(21,11,'SDSU room'),(22,12,'UCSD room');
INSERT INTO public.time_slots(id,resource_id,start_time,end_time) VALUES
(31,21,now()+interval '1 day',now()+interval '1 day 1 hour'),
(32,22,now()+interval '1 day',now()+interval '1 day 1 hour');`);
let passed=0;
async function asUser(n,sql){return await db.transaction(async tx=>{
 await tx.exec(`SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000${n}',true);`);
 return tx.query(sql);
});}
function ok(cond,label){if(!cond)throw new Error(label);console.log('PASS '+label);passed++;}
async function denied(n, sql, label, expectedCode = '42501') {
  try { await asUser(n, sql); }
  catch (error) {
    if (error.code !== expectedCode) throw new Error(label + ': expected SQLSTATE ' + expectedCode + ', received ' + error.code);
    ok(true, label + ' [' + error.code + ']');
    return;
  }
  throw new Error('NOT DENIED ' + label);
}
ok((await asUser(1,'SELECT code FROM public.get_admin_organization()')).rows[0].code==='SDSU','SDSU trusted context');
ok((await asUser(2,'SELECT code FROM public.get_admin_organization()')).rows[0].code==='UCSD','UCSD trusted context');
ok((await asUser(4,'SELECT * FROM public.get_admin_organization()')).rows.length===0,'unassigned admin gets no university');
ok((await asUser(1,"UPDATE public.locations SET name='edited' WHERE id=11 RETURNING id")).rows.length===1,'own edit');
ok((await asUser(1,"UPDATE public.locations SET name='bad' WHERE id=12 RETURNING id")).rows.length===0,'foreign edit updates no rows');
ok((await asUser(2,"UPDATE public.locations SET name='UCSD edited' WHERE id=12 RETURNING id")).rows.length===1,'UCSD own edit');
ok((await asUser(2,"UPDATE public.locations SET name='bad' WHERE id=11 RETURNING id")).rows.length===0,'UCSD cannot edit SDSU');
ok((await asUser(4,"UPDATE public.locations SET name='bad' WHERE id=11 RETURNING id")).rows.length===0,'unassigned admin cannot edit');
await denied(1,"UPDATE public.profiles SET role='administrator'",'university admin cannot edit global roles');
await denied(3,"INSERT INTO public.organization_admins(user_id,organization_id) VALUES(auth.uid(),1)",'cannot assign own university');
await denied(1,"INSERT INTO public.locations(name,organization_id) SELECT 'spoofed',id FROM public.organizations WHERE code='UCSD'",'cannot create under foreign university');
await denied(1,'UPDATE public.locations SET organization_id=2 WHERE id=11','cannot transfer location ownership');
await denied(3,"UPDATE public.profiles SET role='administrator'",'user cannot promote self');
await denied(1,'DELETE FROM public.resources WHERE id=21','no hard deletion');
await denied(1,'UPDATE public.resources SET location_id=12 WHERE id=21','no parent transfer');
await denied(1,'SELECT public.set_managed_slot_active(32,false)','foreign slot denied');
await asUser(1,'SELECT public.set_managed_slot_active(31,false)');
ok((await asUser(3,'SELECT id FROM public.time_slots WHERE id=31')).rows.length===0,'inactive slot hidden');
await denied(3,"INSERT INTO public.bookings(user_id,time_slot_id) VALUES(auth.uid(),31)",'inactive slot booking denied','23514');
await asUser(1,'SELECT public.set_managed_slot_active(31,true)');
const book=(await asUser(3,'INSERT INTO public.bookings(user_id,time_slot_id) VALUES(auth.uid(),31) RETURNING id')).rows[0].id;
await denied(1,'SELECT public.set_managed_slot_active(31,false)','booked slot disable denied','23514');
await denied(1,'UPDATE public.resources SET is_active=false WHERE id=21','booked room archive denied','23514');
await denied(1,'UPDATE public.locations SET is_active=false WHERE id=11','booked location archive denied','23514');
await denied(2,`SELECT public.cancel_managed_booking(${book})`,'foreign cancellation denied');
await asUser(1,`SELECT public.cancel_managed_booking(${book})`);
ok((await asUser(3,`SELECT status FROM public.bookings WHERE id=${book}`)).rows[0].status==='cancelled','managed cancel preserves history');
await asUser(1,'UPDATE public.resources SET is_active=false WHERE id=21');
ok((await asUser(3,'SELECT id FROM public.resources WHERE id=21')).rows.length===0,'archived room hidden');
await asUser(1,'UPDATE public.locations SET is_active=false WHERE id=11');
await denied(1,'UPDATE public.resources SET is_active=true WHERE id=21','restore parent first','23514');
await asUser(1,'UPDATE public.locations SET is_active=true WHERE id=11');
await asUser(1,'UPDATE public.resources SET is_active=true WHERE id=21');
ok((await asUser(3,'SELECT id FROM public.resources WHERE id=21')).rows.length===1,'restore room');
await asUser(3,'INSERT INTO public.bookings(user_id,time_slot_id) VALUES(auth.uid(),31)');
await denied(3,'INSERT INTO public.bookings(user_id,time_slot_id) VALUES(auth.uid(),31)','duplicate active booking blocked','23505');
await db.exec(`INSERT INTO public.locations(id,name,is_active,organization_id)
SELECT value.id,value.name,value.active,o.id FROM (VALUES
(13,'Deletion fixtures',true),(14,'Empty archived location',false),(16,'Inactive admin test',false)) AS value(id,name,active)
CROSS JOIN public.organizations o WHERE o.code='SDSU';
INSERT INTO public.resources(id,location_id,name,is_active) VALUES
(23,13,'Empty archived room',false),(24,13,'Active room',true),
(25,13,'Room with unused slot',true),(26,13,'Room with cancelled history',true);
INSERT INTO public.time_slots(id,resource_id,start_time,end_time) VALUES
(33,25,now()+interval '2 days',now()+interval '2 days 1 hour'),
(34,26,now()+interval '2 days',now()+interval '2 days 1 hour');`);
await denied(3,"SELECT public.delete_archived_inventory('resources',23)",'regular user cannot delete');
await denied(4,"SELECT public.delete_archived_inventory('resources',23)",'unassigned admin cannot delete');
await denied(2,"SELECT public.delete_archived_inventory('resources',23)",'UCSD cannot delete SDSU');
await denied(1,"SELECT public.delete_archived_inventory('resources',22)",'SDSU cannot delete UCSD');
await denied(1,"SELECT public.delete_archived_inventory('resources',24)",'active empty room cannot delete','23514');
await denied(1,"SELECT public.delete_archived_inventory('locations',13)",'active location cannot delete','23514');
await asUser(1,'UPDATE public.resources SET is_active=false WHERE id=25');
await denied(1,"SELECT public.delete_archived_inventory('resources',25)",'unused slot still blocks room deletion','23514');
const history=(await asUser(3,'INSERT INTO public.bookings(user_id,time_slot_id) VALUES(auth.uid(),34) RETURNING id')).rows[0].id;
await asUser(1,`SELECT public.cancel_managed_booking(${history})`);
await asUser(1,'UPDATE public.resources SET is_active=false WHERE id=26');
await denied(1,"SELECT public.delete_archived_inventory('resources',26)",'cancelled history blocks room deletion','23514');
ok((await db.query(`SELECT status FROM public.bookings WHERE id=${history}`)).rows[0].status==='cancelled','history remains after deletion rejection');
await asUser(1,'UPDATE public.locations SET is_active=false WHERE id=13');
await denied(1,"SELECT public.delete_archived_inventory('locations',13)",'location with rooms cannot delete','23514');
const deletedRoom=(await asUser(1,"SELECT public.delete_archived_inventory('resources',23) AS result")).rows[0].result;
ok(deletedRoom.id===23&&deletedRoom.type==='resources'&&deletedRoom.deleted===true,'empty archived room deletion confirmed');
ok((await db.query('SELECT id FROM public.resources WHERE id=23')).rows.length===0,'only selected room removed');
await denied(1,"SELECT public.delete_archived_inventory('resources',23)",'repeated deletion does not report success');
const deletedLocation=(await asUser(1,"SELECT public.delete_archived_inventory('locations',14) AS result")).rows[0].result;
ok(deletedLocation.id===14&&deletedLocation.type==='locations'&&deletedLocation.deleted===true,'empty archived location deletion confirmed');
ok((await db.query('SELECT id FROM public.locations WHERE id=14')).rows.length===0,'selected empty location removed');
ok((await db.query('SELECT id FROM public.locations WHERE id IN (11,12,16)')).rows.length===3,'other universities and unrelated locations preserved');
await denied(1,"SELECT public.delete_archived_inventory('locations',12)",'foreign location deletion denied');
await denied(1,"SELECT public.delete_archived_inventory('resources',99999)",'missing record deletion denied');
await denied(1,"SELECT public.delete_archived_inventory(NULL,23)",'null deletion kind blocked','22023');
await denied(1,"SELECT public.delete_archived_inventory('profiles',1)",'unsupported deletion kind blocked','22023');
await denied(1,"SELECT public.delete_archived_inventory('resources',NULL)",'null deletion ID blocked','22023');
await denied(1,"SELECT public.delete_archived_inventory('resources',0)",'zero deletion ID blocked','22023');
await db.transaction(async tx=>{
 await tx.exec('SET LOCAL ROLE anon');
 try { await tx.query("SELECT public.delete_archived_inventory('locations',16)"); throw new Error('anon not denied'); }
 catch(e) { if(e.code!=='42501')throw e; }
});
ok(true,'anonymous caller has no RPC execute permission');
await db.exec("UPDATE public.profiles SET is_active=false WHERE id='00000000-0000-0000-0000-000000000001'");
await denied(1,"SELECT public.delete_archived_inventory('locations',16)",'inactive admin cannot delete');
ok((await asUser(1,'SELECT * FROM public.get_admin_organization()')).rows.length===0,'inactive admin context denied');
await denied(1,'SELECT public.set_managed_slot_active(31,false)','inactive admin cannot mutate');
await db.exec("UPDATE public.profiles SET is_active=true WHERE id='00000000-0000-0000-0000-000000000001'");
await db.exec("UPDATE public.organization_admins SET is_active=false WHERE user_id='00000000-0000-0000-0000-000000000001'");
await denied(1,"SELECT public.delete_archived_inventory('locations',16)",'disabled university assignment cannot delete');
await db.exec("UPDATE public.organization_admins SET is_active=true WHERE user_id='00000000-0000-0000-0000-000000000001'");
for(const file of ['inactive_account.sql','booking_times.sql','booking_ownership.sql']) {
  await db.exec(fs.readFileSync(base+'/database/tests/'+file,'utf8'));console.log('PASS legacy '+file);
}
// Kiosk read tests. All fixtures live in this disposable in-memory database.
await db.exec(`INSERT INTO public.resources(id,location_id,name,is_active) VALUES
(40,11,'Kiosk study room',true),(41,12,'Kiosk empty room',true),
(42,11,'Archived kiosk room',false),(43,13,'Room under archived location',true);
WITH bounds AS (SELECT * FROM public.kiosk_day_bounds(clock_timestamp()))
INSERT INTO public.time_slots(id,resource_id,start_time,end_time,is_active)
SELECT v.id,v.room,v.start_time,v.end_time,v.active
FROM bounds b CROSS JOIN LATERAL (VALUES
(61,40,b.day_start-interval '1 hour',b.day_start+interval '1 hour',true),
(62,40,b.day_start+interval '1 hour',b.day_end-interval '1 hour',true),
(63,40,b.day_end-interval '1 hour',b.day_end+interval '1 hour',true),
(64,40,b.day_start-interval '3 hours',b.day_start-interval '2 hours',true),
(65,40,b.day_end+interval '2 hours',b.day_end+interval '3 hours',true),
(66,41,b.day_start+interval '2 hours',b.day_start+interval '3 hours',false)
) AS v(id,room,start_time,end_time,active);`);
// Historical bookings stand in for reservations created before their start.
// Disable ONLY the future-booking guard while the test owner seeds them.
// This transaction is local test-fixture setup, NEVER a live setup instruction.
await db.transaction(async tx => {
  await tx.exec(`ALTER TABLE public.bookings DISABLE TRIGGER guard_new_booking;
    INSERT INTO public.bookings(user_id,time_slot_id,status,cancelled_at) VALUES
    ('00000000-0000-0000-0000-000000000003',61,'active',NULL),
    ('00000000-0000-0000-0000-000000000003',62,'active',NULL),
    ('00000000-0000-0000-0000-000000000003',63,'cancelled',clock_timestamp());
    ALTER TABLE public.bookings ENABLE TRIGGER guard_new_booking;`);
});
await denied(3,'INSERT INTO public.bookings(user_id,time_slot_id) VALUES(auth.uid(),61)','booking time guard restored after historical fixture','23514');
const kiosk = (await asUser(5,'SELECT public.get_room_kiosk_status(40) AS result')).rows[0].result;
ok(kiosk.resource.id===40&&kiosk.resource.location.id===11,'kiosk reads active room and location');
ok(kiosk.timezone==='America/Los_Angeles','kiosk timezone is explicit');
ok(kiosk.slots.map(s=>s.id).join(',')==='61,62,63','kiosk includes overnight slots and excludes other days');
ok(kiosk.slots[0].is_booked===true&&kiosk.slots[1].is_booked===true,'kiosk sees reserved status across users');
ok(kiosk.slots[2].is_booked===false,'cancelled bookings do not mark a slot booked');
ok((await asUser(5,'SELECT id FROM public.bookings WHERE time_slot_id IN (61,62,63)')).rows.length===0,'kiosk caller still cannot read other user reservations');
ok(kiosk.slots.every(s=>Object.keys(s).sort().join(',')==='end_time,id,is_booked,start_time'),'kiosk slot fields have no user or booking identifiers');
ok(Object.keys(kiosk.resource).sort().join(',')==='id,location,name','kiosk resource fields contain no account data');
const emptyKiosk=(await asUser(3,'SELECT public.get_room_kiosk_status(41) AS result')).rows[0].result;
ok(emptyKiosk.slots.length===0,'inactive slots are absent; empty active room is valid');
await denied(3,'SELECT public.get_room_kiosk_status(42)','archived room not displayed','P0002');
await denied(1,'SELECT public.get_room_kiosk_status(42)','admin cannot display archived room as available','P0002');
await denied(3,'SELECT public.get_room_kiosk_status(43)','archived parent room not displayed','P0002');
await denied(3,'SELECT public.get_room_kiosk_status(99999)','missing room not displayed','P0002');
await denied(3,'SELECT public.get_room_kiosk_status(0)','invalid kiosk room denied','22023');
await denied(3,'SELECT * FROM public.kiosk_day_bounds(clock_timestamp())','authenticated caller cannot use private clock helper');
await db.exec("UPDATE public.profiles SET is_active=false WHERE id='00000000-0000-0000-0000-000000000005'");
await denied(5,'SELECT public.get_room_kiosk_status(40)','inactive account cannot read kiosk');
await db.exec("UPDATE public.profiles SET is_active=true WHERE id='00000000-0000-0000-0000-000000000005'");
for(const [observed,hours] of [['2026-03-08T19:00:00Z',23],['2026-11-01T19:00:00Z',25]]) {
  const duration=(await db.query(`SELECT extract(epoch FROM (day_end-day_start))/3600 AS hours FROM public.kiosk_day_bounds('${observed}'::timestamptz)`)).rows[0].hours;
  ok(Number(duration)===hours,'San Diego daylight-saving day has '+hours+' hours');
}
for(const [observed,first,last] of [
  ['2026-03-08T19:00:00Z','2026-03-08T08:00:00Z','2026-03-09T07:00:00Z'],
  ['2026-11-01T19:00:00Z','2026-11-01T07:00:00Z','2026-11-02T08:00:00Z'],
]) {
  const correct=(await db.query(`SELECT day_start='${first}'::timestamptz AND day_end='${last}'::timestamptz AS correct FROM public.kiosk_day_bounds('${observed}'::timestamptz)`)).rows[0].correct;
  ok(correct,'San Diego midnight UTC boundaries match '+observed.slice(0,10));
}
await db.transaction(async tx => {
  await tx.exec('SET LOCAL ROLE anon');
  try { await tx.query('SELECT public.get_room_kiosk_status(40)'); throw new Error('anonymous kiosk read not denied'); }
  catch(error) { if(error.code!=='42501') throw error; }
});
ok(true,'anonymous caller cannot execute kiosk RPC');
console.log(`${passed} database checks passed (embedded PostgreSQL, not live Supabase; concurrency not measured)`);
await db.close();
