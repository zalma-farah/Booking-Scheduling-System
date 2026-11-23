import { test, expect } from '@playwright/test'

test('sign-in page exposes the public walk-in directory', async ({ page }) => {
  await page.route('**/api/public/walk-in/rooms?*', route => route.fulfill({json:{status:'ok',rooms:[{id:7,name:'Study room',location:{id:1,name:'Library'}}],next_after:null}}))
  await page.goto('/login')
  await page.getByRole('link',{name:'Walk-in room booking — no account needed'}).click()
  await expect(page).toHaveURL(/\/walk-in$/)
  await expect(page.getByRole('heading',{name:'Study room'})).toBeVisible()
})

test('guest selects duration and confirms without personal credentials', async ({ page }) => {
  let saved=false, writes=0
  const checked=Date.parse('2026-11-22T18:00:00Z')
  await page.route('**/api/public/rooms/7/status',route=>route.fulfill({json:{status:'ok',timezone:'America/Los_Angeles',state:saved?'in_use':'available',
    checked_at:new Date(checked).toISOString(),day_start:'2026-11-22T08:00:00Z',day_end:'2026-11-23T08:00:00Z',
    resource:{id:7,name:'Study room',location:{id:1,name:'Library'}},
    slots:saved?[{id:1,start_time:new Date(checked).toISOString(),end_time:new Date(checked+1800000).toISOString(),is_booked:true}]:[]}}))
  await page.route('**/api/public/rooms/7/walk-in',async route=>{
    expect(route.request().headers().authorization).toBeUndefined()
    if(route.request().method()==='POST') {
      writes++
      const body=route.request().postDataJSON()
      expect(Object.keys(body).sort()).toEqual(['end_time','request_id'])
      saved=true
      return route.fulfill({json:{status:'ok',reservation:{resource_id:7,start_time:new Date(checked).toISOString(),end_time:body.end_time,request_id:body.request_id,status:'active'}}})
    }
    return route.fulfill({json:{status:'ok',resource_id:7,checked_at:new Date(checked).toISOString(),available_until:saved?null:new Date(checked+7200000).toISOString(),max_minutes:120}})
  })
  await page.goto('/resources/7/kiosk')
  await page.getByRole('button',{name:/30 minutes/}).click()
  await page.getByRole('button',{name:'Confirm guest reservation',exact:true}).click()
  await expect(page.getByText(/Walk-in reservation confirmed until/)).toBeVisible()
  await expect(page.getByRole('heading',{name:'BOOKED NOW',exact:true})).toBeVisible()
  expect(writes).toBe(1)
})
