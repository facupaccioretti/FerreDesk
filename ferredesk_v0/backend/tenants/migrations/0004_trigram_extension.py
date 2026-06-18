# Generated manually to fix pg_trgm location

from django.db import migrations
from django.contrib.postgres.operations import TrigramExtension

class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0003_solicitudonboardingtenant'),
    ]

    operations = [
        TrigramExtension(),
    ]
