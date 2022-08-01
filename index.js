const axios = require('axios').default;
const cron = require('node-cron');

const config = require('./config.json');

var note = '';
var totalRAM = 0;
var totalDisk = 0;
var runningRAM = 0;

cron.schedule('* * * * *', () => {
	// The seemingly unnecessary escapes and double newlines are so that
	// Proxmox displays this properly after the markdown parser runs.
	note = '\\# Note managed by PVE-Automate. Do not edit.\n\n---\n\n';
	totalRAM = 0;
	totalDisk = 0;
	runningRAM = 0;

	getLXCInfo().then(() => {
		getVMInfo().then(() => {
			note += `Running RAM: ${runningRAM}MB (${Math.round(runningRAM / 1024 * 100) / 100}GB)\n\n`;
			note += `Total RAM: ${totalRAM}MB (${Math.round(totalRAM / 1024 * 100) / 100}GB)\n\n`;
			note += `Total Disk: ${Math.round(totalDisk * 100) / 100}GB`;

			axios.put(createURL(`nodes/${config.nodeId}/config`), {
				description: note
			}, {
				headers: {
					Authorization: `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`
				}
			}).catch((err) => {
				console.log(err);
				console.error('Failed to update note:');
				console.error(err.response.statusText);
			});
		}).catch((err) => {
			console.error('Failed to get data from Proxmox:');
			console.error(err);
		});
	}).catch((err) => {
		console.error('Failed to get data from Proxmox:');
		console.error(err);
	});
});

function createURL(route) {
	var url = new URL(config.pveUrl);
	url.pathname = `/api2/json/${route}`;
	return url.toString();
}

function bytesToMB(bytes) {
	return bytes / 1024 / 1024;
}

function bytesToGB(bytes) {
	return bytes / 1024 / 1024 / 1024;
}

function getLXCInfo() {
	return new Promise((resolve, reject) => {
		axios.get(createURL(`nodes/${config.nodeId}/lxc`), {
			headers: {
				Authorization: `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`
			}
		}).then((response) => {
			note += formatVMData(response.data.data);
			resolve();
		}).catch((err) => {
			reject(new Error(`${err.response.status}: ${err.response.statusText}`));
		});
	});
}

function getVMInfo() {
	return new Promise((resolve, reject) => {
		axios.get(createURL(`nodes/${config.nodeId}/qemu`), {
			headers: {
				Authorization: `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`
			}
		}).then((response) => {
			note += formatVMData(response.data.data);
			resolve();
		}).catch((err) => {
			reject(new Error(`${err.response.status}: ${err.response.statusText}`));
		});
	});
}

function formatVMData(data) {
	var output = '';

	output += 'Containers\n\n';
	output += '\\==========\n\n';
	output += 'ID (Name) CPU RAM Disk [Status]\n\n';
	output += '\\----------\n\n';

	for (var i = 0; i < data.length; i++) {
		let thisVM = data[i];

		if (thisVM.template === 1) continue;

		output += `${thisVM.vmid} (${thisVM.name}) ${thisVM.cpus} ${bytesToMB(thisVM.maxmem)}MB ${Math.round(bytesToGB(thisVM.maxdisk) * 100) / 100}GB [${thisVM.status}]\n\n`;
		totalRAM += bytesToMB(thisVM.maxmem);
		totalDisk += bytesToGB(thisVM.maxdisk);

		if (thisVM.status === 'running') {
			runningRAM += bytesToMB(thisVM.maxmem);
		}
	}

	output += '\n\n---\n\n';

	return output;
}