from django.apps import AppConfig
from django.db.backends.signals import connection_created
def configure_sqlite(sender,connection,**kwargs):
 if connection.vendor=='sqlite':
  with connection.cursor() as c:c.execute('PRAGMA journal_mode=WAL')
class ProofsConfig(AppConfig):
 name='proofs'
 def ready(self):connection_created.connect(configure_sqlite,dispatch_uid='proofs_wal')
