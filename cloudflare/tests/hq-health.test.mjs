import test from "node:test";
import assert from "node:assert/strict";
import {headquartersHealth} from "../src/worker.mjs";
const now="2026-11-16T12:00:00Z";
test("HQ reports scoped API and D1 health when heartbeat is current",()=>{
 const v=headquartersHealth([{key:"last_cron",checked_at:"2026-11-16T11:55:00Z"}],now);
 assert.equal(v.status,"responding");assert.equal(v.collector,"current");
 assert.equal(v.api,"responding");assert.equal(v.database,"responding");
 assert.match(v.note,/not independent uptime/);
});
test("HQ warns when the scheduler heartbeat is stale",()=>{
 const v=headquartersHealth([{key:"last_cron",checked_at:"2026-11-16T11:35:00Z"}],now);
 assert.equal(v.status,"delayed");assert.equal(v.collector,"stale");
});
test("HQ does not claim health with a missing or future heartbeat",()=>{
 assert.equal(headquartersHealth([],now).status,"unknown");
 assert.equal(headquartersHealth([{key:"last_cron",checked_at:"2026-11-17T12:00:00Z"}],now).status,"unknown");
});
