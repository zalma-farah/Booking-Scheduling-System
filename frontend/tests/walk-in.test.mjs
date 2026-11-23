import test from 'node:test'
import assert from 'node:assert/strict'
import { confirmationId, durationOptions, readPending, readWalkInQuote, readWalkInReceipt } from '../src/lib/walk-in.js'
const data = { status: 'ok', resource_id: 7, checked_at: '2026-11-22T01:00:00Z', available_until: '2026-11-22T03:00:00Z', max_minutes: 120 }
const body = { end_time: data.available_until, request_id: '10000000-0000-4000-8000-000000000001' }
test('30/60/until choices are bounded by server window', () => {
  const options = durationOptions(readWalkInQuote(data, '7'), 0)
  assert.deepEqual(options.map(o=>o.key), ['30','60','until'])
  assert.equal(options.at(-1).end, data.available_until.replace('Z','.000Z'))
})
test('a short window only offers until-end and cannot cross next booking', () => {
  const quote = readWalkInQuote({...data,available_until:'2026-11-22T01:20:00Z'},7)
  assert.deepEqual(durationOptions(quote,0).map(o=>o.key),['until'])
})
test('no duplicate duration at exact 30 minute boundary', () => {
  const quote=readWalkInQuote({...data,available_until:'2026-11-22T01:30:00Z'},7)
  assert.equal(durationOptions(quote,0).length,1)
})
for(const age of [30000,31000,-1,NaN,Infinity]) test('stale/invalid quote cannot reserve '+age,()=>{
  assert.deepEqual(durationOptions(readWalkInQuote(data,7),age),[])
})
test('no active hours means no choices',()=>{
  assert.deepEqual(durationOptions(readWalkInQuote({...data,available_until:null},7),0),[])
})
for(const change of [d=>d.max_minutes=121,d=>d.resource_id=8,d=>d.checked_at='bad',
  d=>d.available_until='2026-11-22T01:00:01Z',d=>d.available_until='2026-11-22T04:00:00Z']) {
  test('malformed/unsafe window rejected '+String(change),()=>{ const d={...data};change(d);assert.throws(()=>readWalkInQuote(d,7)) })
}
test('secure random confirmation works without randomUUID',()=>{
  const a=confirmationId(), b=confirmationId()
  assert.match(a,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.notEqual(a,b)
})
test('pending confirmation persists only opaque ID and requested end',()=>{
  assert.deepEqual(readPending(JSON.stringify(body)),body)
  assert.equal(readPending(null),null)
  assert.throws(()=>readPending(JSON.stringify({...body,user_id:'spoof'})))
})
test('confirmation must match this exact request',()=>{
  const d={status:'ok',reservation:{...body,resource_id:7,start_time:data.checked_at,status:'active'}}
  assert.equal(readWalkInReceipt(d,body,7).status,'active')
  assert.throws(()=>readWalkInReceipt(d,{...body,request_id:confirmationId()},7))
  assert.throws(()=>readWalkInReceipt(d,body,8))
  assert.throws(()=>readWalkInReceipt({...d,reservation:{...d.reservation,status:'unknown'}},body,7))
})
