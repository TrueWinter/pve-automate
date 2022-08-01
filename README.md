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