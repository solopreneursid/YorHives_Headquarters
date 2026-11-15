import json,sqlite3,sys,tempfile,unittest
from datetime import datetime,timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'intelligence'))
from private_inference import investigate,validate_model
from recovery import backup,rehearse
class Operations(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.state=Path(self.temp.name)
  self.report={'schemaVersion':'yorphives.hq-intelligence.v1','pipeline':{'readOnly':True,'generatedAt':datetime.now(timezone.utc).isoformat()},'findings':[{'id':'f1','description':'HTTP failure','evidence':['https://example.com'],'observedAt':datetime.now(timezone.utc).isoformat()}]}
 def responder(self,method,path,payload=None,timeout=None):
  if path=='/api/tags':return {'models':[{'name':'test-local:1','digest':'sha256-fixture'}]}
  self.assertEqual(path,'/api/chat');self.assertFalse(payload['stream']);self.assertNotIn('tools',payload);self.assertEqual(payload['options']['num_predict'],512)
  return {'message':{'content':json.dumps({'summary':'Possible outage','recommendation':'Inspect independently','uncertainties':['A single observation is insufficient'],'evidenceIds':['f1']})}}
 def test_disabled_and_no_work_do_not_contact_model(self):
  def reject(*a,**k):raise AssertionError('Unexpected model call')
  self.assertEqual(investigate(self.state,self.report,'',reject)['status'],'not-configured')
  self.assertEqual(investigate(self.state,{**self.report,'findings':[]},'test-local:1',reject)['status'],'no-investigation-needed')
 def test_valid_analysis_is_unverified_and_cached(self):
  result=investigate(self.state,self.report,'test-local:1',self.responder)
  self.assertEqual(result['classification'],'unverified-model-inference')
  self.assertEqual(investigate(self.state,self.report,'test-local:1',lambda *a,**k:None),result)
 def test_stale_evidence_never_triggers_inference(self):
  self.report['pipeline']['generatedAt']='2000-01-01T00:00:00Z'
  self.assertEqual(investigate(self.state,self.report,'test-local:1',lambda *a,**k:None)['status'],'evidence-stale-or-invalid')
 def test_cloud_models_are_refused(self):
  with self.assertRaises(ValueError):validate_model('cloud:1',self.responder)
  with self.assertRaises(ValueError):validate_model('test-local:1',lambda *a,**k:{'models':[{'name':'test-local:1','digest':'x','remote_host':'remote'}]})
 def test_failed_attempts_consume_budget(self):
  def unavailable(*a,**k):raise OSError('offline')
  for i in range(3):
   self.report['findings'][0]['description']=str(i)
   self.assertEqual(investigate(self.state,self.report,'test-local:1',unavailable)['status'],'model-unavailable-or-output-rejected')
  self.report['findings'][0]['description']='fourth'
  self.assertEqual(investigate(self.state,self.report,'test-local:1',unavailable)['status'],'daily-budget-exhausted')
 def test_invented_citations_are_rejected(self):
  def bad(method,path,payload=None,timeout=None):
   result=self.responder(method,path,payload,timeout)
   if path=='/api/chat':result['message']['content']=json.dumps({'summary':'x','recommendation':'x','uncertainties':[],'evidenceIds':['invented']})
   return result
  self.assertEqual(investigate(self.state,self.report,'test-local:1',bad)['status'],'model-unavailable-or-output-rejected')
 def test_backup_restore_preserves_decisions_and_never_overwrites(self):
  source=self.state/'source.sqlite'
  with sqlite3.connect(source) as db:db.execute('CREATE TABLE decisions(id TEXT)');db.execute("INSERT INTO decisions VALUES('retained')")
  destination=self.state/'backups'/'snapshot.sqlite';before=source.read_bytes()
  result=backup(source,destination);self.assertEqual(result['tables']['decisions'],1)
  self.assertEqual(rehearse(destination)['status'],'restore-rehearsal-passed');self.assertEqual(source.read_bytes(),before)
  with self.assertRaises(ValueError):backup(source,destination)
if __name__=='__main__':unittest.main(verbosity=2)
