# PVE-Automate

PVE-Automate is a Node.js script that keeps track of your allocated RAM and disk to help prevent you from over-allocating these.

It will update your node's notes every minute with data in the following format:

```
Containers
==========
ID (Name) CPU RAM Disk [Status]
----------
106 (web01) 1 1024MB 7.78GB [running]
```

The note will end with totals:

```
Running RAM: 9664MB (9.44GB)
Total RAM: 10688MB (10.44GB)
Total Disk: 112.86GB
```

> **Important**: PVE-Automate will manage your node's notes and will override any changes made. Your container/VM notes will not be modified.

You will need to provide an API key with the `VM.Audit, Sys.Modify, Sys.Audit` permissions.