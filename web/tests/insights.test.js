import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAnalytics} from '../../src/analytics.js';
import {analytics} from '../insights.js';

test('Insights shows real numeric zero, exact-match limitations and image-free source details without invented learning',()=>{
 const data=calculateAnalytics({observedAt:'2026-11-20T12:00:00Z',posts:[{id:'network',status:'sent',text:'<script>private caption</script>',externalLink:'https://instagram.com/p/Exact/',sentAt:'2026-11-01T12:00:00Z',metricsUpdatedAt:'2026-11-18T12:00:00Z',metrics:[{name:'reach',value:3,unit:'count'},{name:'saves',value:0,unit:'count'}]}]});
 const html=analytics({workspace:{analytics:data}});
 assert.match(html,/Studio post match not verified/);assert.match(html,/Matching caption text alone is not enough/);assert.match(html,/<dd>0<\/dd>/);assert.match(html,/https:\/\/www.instagram.com\/p\/Exact\//);
 assert.ok(!html.includes('<script>'));assert.match(html,/No engagement rate, causal performance recommendation, optimal posting time/);
 assert.match(html,/recent, exact Studio-post match is still needed/);assert.match(html,/2026/);
});

test('fresh exact post observations visibly enter editorial context with no causal claim or automatic operation control',()=>{
 const data=calculateAnalytics({observedAt:'2026-11-20T12:00:00Z',stories:[{id:'story',title:'An observed post',revision:'r1',publishing:{postIds:['writer']}}],posts:[{id:'writer',status:'sent',sentAt:'2026-11-17T12:00:00Z',metricsUpdatedAt:'2026-11-19T12:00:00Z',metrics:[{name:'shares',value:2,unit:'count'}]}]});
 const html=analytics({workspace:{analytics:data}});
 assert.match(html,/1 recent, matched publication observation is available/);assert.match(html,/Shares 2/);assert.match(html,/not.*claim your current edits caused/s);assert.ok(!html.includes('data-action='));
});
