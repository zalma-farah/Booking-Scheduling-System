import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import fs from 'node:fs';
const base=new URL('../..', import.meta.url).pathname;
const db=new PGlite({extensions:{btree_gist}});
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
for(const file of ['database/schema.sql','database/migrations/001_resource_availability.sql','database/migrations/002_booking_rules.sql','database/migrations/003_organization_access.sql','database/migrations/004_managed_operations.sql']){
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
async function denied(n,sql,label){try{await asUser(n,sql);}catch(e){ok(true,label+' ['+e.code+']');return;}throw new Error('NOT DENIED '+label);}
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
await denied(3,"INSERT INTO public.bookings(user_id,time_slot_id) VALUES(auth.uid(),31)",'inactive slot booking denied');
await asUser(1,'SELECT public.set_managed_slot_active(31,true)');
const book=(await asUser(3,'INSERT INTO public.bookings(user_id,time_slot_id) VALUES(auth.uid(),31) RETURNING id')).rows[0].id;
await denied(1,'SELECT public.set_managed_slot_active(31,false)','booked slot disable denied');
await denied(1,'UPDATE public.resources SET is_active=false WHERE id=21','booked room archive denied');
await denied(1,'UPDATE public.locations SET is_active=false WHERE id=11','booked location archive denied');
await denied(2,`SELECT public.cancel_managed_booking(${book})`,'foreign cancellation denied');
await asUser(1,`SELECT public.cancel_managed_booking(${book})`);
ok((await asUser(3,`SELECT status FROM public.bookings WHERE id=${book}`)).rows[0].status==='cancelled','managed cancel preserves history');
await asUser(1,'UPDATE public.resources SET is_active=false WHERE id=21');
ok((await asUser(3,'SELECT id FROM public.resources WHERE id=21')).rows.length===0,'archived room hidden');
await asUser(1,'UPDATE public.locations SET is_active=false WHERE id=11');
await denied(1,'UPDATE public.resources SET is_active=true WHERE id=21','restore parent first');
await asUser(1,'UPDATE public.locations SET is_active=true WHERE id=11');
await asUser(1,'UPDATE public.resources SET is_active=true WHERE id=21');
ok((await asUser(3,'SELECT id FROM public.resources WHERE id=21')).rows.length===1,'restore room');
await asUser(3,'INSERT INTO public.bookings(user_id,time_slot_id) VALUES(auth.uid(),31)');
await denied(3,'INSERT INTO public.bookings(user_id,time_slot_id) VALUES(auth.uid(),31)','duplicate active booking blocked');
await db.exec("UPDATE public.profiles SET is_active=false WHERE id='00000000-0000-0000-0000-000000000001'");
ok((await asUser(1,'SELECT * FROM public.get_admin_organization()')).rows.length===0,'inactive admin context denied');
await denied(1,'SELECT public.set_managed_slot_active(31,false)','inactive admin cannot mutate');
await db.exec("UPDATE public.profiles SET is_active=true WHERE id='00000000-0000-0000-0000-000000000001'");
for(const file of ['inactive_account.sql','booking_times.sql','booking_ownership.sql']) {
  await db.exec(fs.readFileSync(base+'/database/tests/'+file,'utf8'));console.log('PASS legacy '+file);
}
console.log(`${passed} database checks passed (embedded PostgreSQL, not live Supabase; concurrency not measured)`);
await db.close();
