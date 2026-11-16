import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{internals} from '../worker.mjs';

test('public URL gate rejects unsafe protocols and credentials',()=>{
  assert.equal(internals.safeHttps('javascript:alert(1)'),null);
  assert.equal(internals.safeHttps('https://a:b@example.com/path'),null);
  assert.equal(internals.safeHttps('http://example.com'),null);
  assert.equal(internals.safeHttps('https://example.com/foo'),'https://example.com/foo');
});
test('feed titles map to known discovery categories',()=>{
  assert.equal(internals.classify('AI agent framework in Rust'),'Technology');
  assert.equal(internals.classify('Business subscription pricing'),'Revenue');
  assert.equal(internals.classify('Top customer pain points in the market'),'Markets');
  assert.equal(internals.classify('A tiny image resizer'),'Apps & Tools');
});
test('sanitise source records: HTTPS only, no hallucinated verification',()=>{
  assert.equal(internals.normalizeDev({title:'Bad',url:'http://evil.com'}),null);
  const a=internals.normalizeDev({title:'Rust agent framework',url:'https://dev.to/article',description:'Learning'});
  assert.equal(a.verified,false);assert.equal(a.category,'Technology');assert.equal(a.source,'DEV Community');
  assert.ok(a.id.startsWith('lead_'));
});
test('anonymous access always fails closed, even without storage',async()=>{
  const r=await worker.fetch(new Request('https://fresh-hq.example/api/bootstrap'),{});
  assert.equal(r.status,403);
  const p=await worker.fetch(new Request('https://fresh-hq.example/'),{});
  assert.equal(p.status,403);
});
test('fake malformed JWT cannot bypass the private worker',async()=>{
  const r=await worker.fetch(new Request('https://fresh-hq.example/',{headers:{'Cf-Access-Jwt-Assertion':'foo.bar.baz'}}),{
    ACCESS_AUD:'aud',ACCESS_TEAM_DOMAIN:'foo.cloudflareaccess.com',ACCESS_OWNER_EMAIL:'owner@example.com'
  });assert.equal(r.status,403);
});