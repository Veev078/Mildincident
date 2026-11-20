import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAnalytics,instagramPublicationUrl} from '../src/analytics.js';

const measuredAt='2026-11-18T23:16:41.627Z',observedAt='2026-11-20T12:00:00Z';
const values=[{type:'reactions',name:'Reactions',value:0,unit:'count'},{type:'views',name:'Views',value:9,unit:'count'},{type:'reach',name:'Reach',value:3,unit:'count'},{type:'saves',name:'Saves',value:0,unit:'count'}];
const post=(id,extra={})=>({id,channelId:'private-channel',status:'sent',text:'Los Angeles, October 2012.',sentAt:'2026-10-31T22:19:31.067Z',...extra});
const story={id:'CON-endeavour',title:'Endeavour through Los Angeles',revision:'source-revision',territory:'Visual culture',publishing:{postIds:['writer']}};

test('real-shaped writer and network imports stay unlinked when only captions match',()=>{
 const result=calculateAnalytics({observedAt,stories:[story],posts:[post('writer',{metrics:null}),post('network',{externalLink:'https://www.instagram.com/p/DfLOVkVGnxi/',metrics:values,metricsUpdatedAt:measuredAt})],performanceRows:[{concept_id:story.id,reach:999,likes:999,measured_date:'2026-11-18'}]});
 assert.equal(result.metrics.find(metric=>metric.name==='reach').value,3);
 assert.equal(result.metrics.find(metric=>metric.name==='likes').value,0);
 assert.equal(result.coverage.unlinkedPerformanceRows,1);
 assert.equal(result.coverage.unmatchedMeasuredPublications,1);
 assert.equal(result.publications.find(post=>post.id==='network').storyMatch,'unmatched');
 assert.equal(result.categories[0].postsWithMetrics,0);
 assert.deepEqual(result.editorialFeedback,[]);
});

test('exact Instagram identity combines mirrors once and binds measured feedback to the mapped Studio story',()=>{
 const result=calculateAnalytics({observedAt,stories:[story],posts:[post('writer',{externalLink:'https://instagram.com/p/DfLOVkVGnxi/?utm_source=buffer',metrics:values,metricsUpdatedAt:measuredAt}),post('network',{externalLink:'https://www.instagram.com/reel/DfLOVkVGnxi/',metrics:values,metricsUpdatedAt:measuredAt})]});
 assert.equal(result.coverage.posts,2);assert.equal(result.coverage.eligiblePublications,1);assert.equal(result.coverage.combinedMirrorRecords,1);
 assert.equal(result.metrics.find(metric=>metric.name==='reach').value,3);assert.equal(result.metrics.find(metric=>metric.name==='reach').sampleSize,1);
 assert.equal(result.categories[0].postsWithMetrics,1);
 assert.deepEqual(result.editorialFeedback[0].publication.bufferPostIds,['writer','network']);
 assert.equal(result.editorialFeedback[0].sourceRevision,'source-revision');assert.equal(result.editorialFeedback[0].reviewer,'provider');
 assert.match(result.editorialFeedback[0].reason,/do not infer what caused it/);
 assert.equal(result.publications[0].measurement.newestAt,measuredAt);
});

test('permalinks require the real HTTPS Instagram host, a post identity and no credentials',()=>{
 for(const value of ['http://instagram.com/p/ABC/','https://instagram.com.evil.example/p/ABC/','https://user:secret@instagram.com/p/ABC/','https://instagram.com/accounts/login/','https://instagram.com/p/ABC/extra'])assert.equal(instagramPublicationUrl(value),null);
 assert.equal(instagramPublicationUrl('https://www.instagram.com/p/AbC_1/?img_index=2'),'https://www.instagram.com/p/AbC_1/');
});

test('identical captions never allow an internal test mirror to enter measured totals',()=>{
 const url='https://www.instagram.com/p/TestExact/';
 const result=calculateAnalytics({posts:[post('test',{text:'INTERNAL CAROUSEL TEST — DO NOT PUBLISH',externalLink:url}),post('import',{externalLink:url,metrics:values})]});
 assert.equal(result.coverage.postsWithMetrics,0);assert.equal(result.metrics.find(metric=>metric.name==='reach').value,null);
});

test('conflicting mirror measurements are withheld unless dated observations establish the newer value',()=>{
 const url='https://www.instagram.com/p/SameExact/';
 const build=(otherDate)=>calculateAnalytics({posts:[post('one',{externalLink:url,metrics:[{name:'reach',unit:'count',value:3}],metricsUpdatedAt:measuredAt}),post('two',{externalLink:url,metrics:[{name:'reach',unit:'count',value:9}],metricsUpdatedAt:otherDate})]});
 for(const date of [measuredAt,null]){const result=build(date);assert.equal(result.metrics.find(metric=>metric.name==='reach').value,null);assert.equal(result.coverage.metricConflicts,1);}
 assert.equal(build('2026-11-19T12:00:00Z').metrics.find(metric=>metric.name==='reach').value,9);
});

test('ambiguous Studio ownership and unknown or stale measurement times cannot generate editorial learning',()=>{
 const url='https://www.instagram.com/p/ExactOnly/';
 const result=calculateAnalytics({observedAt,stories:[story,{id:'other',revision:'other',publishing:{postIds:['network']}}],posts:[post('writer',{externalLink:url}),post('network',{externalLink:url,metrics:values,metricsUpdatedAt:measuredAt})]});
 assert.equal(result.publications[0].storyMatch,'ambiguous');assert.deepEqual(result.editorialFeedback,[]);assert.ok(result.categories.every(category=>category.postsWithMetrics===0));
 for(const date of [null,'2026-10-18T12:00:00Z','2026-11-21T12:00:00Z']){const old=calculateAnalytics({observedAt,stories:[story],posts:[post('writer',{metrics:values,metricsUpdatedAt:date})]});assert.deepEqual(old.editorialFeedback,[]);assert.equal(old.metrics.find(metric=>metric.name==='views').value,9);}
});
