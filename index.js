const axios = require('axios').default;
const cron = require('node-cron');

const config = require('./config.json');

var note = '';
var totalRAM = 0;
var totalDisk = 0;
var runningRAM = 0;
var systemRAM = 0;

var pveVersion = 0;
var shouldEscape = false;

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

axios.get(createURL(`nodes/${config.nodeId}/version`), {
	headers: {
		Authorization: `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`
	}
}).then((response) => {
	pveVersion = response.data.data.version.split('.')[0];

	if (!['6', '7'].includes(pveVersion)) {
		console.warn(`Detected PVE version ${pveVersion}, pve-automate may not be fully compatible with this version`);
	}

	if (pveVersion && pveVersion >= 7) {
		shouldEscape = true;
	}

	function formatForVersion(input, escape, newline) {
		var output = '';

		if (escape && shouldEscape) {
			output += '\\';
		}

		output += input;

		if (newline) {
			output += shouldEscape ? '\n\n' : '\n';
		}

		return output;
	}

	cron.schedule('* * * * *', () => {
		// The seemingly unnecessary escapes and double newlines are so that
		// Proxmox v7+ displays this properly after the markdown parser runs.
		note = formatForVersion('# Note managed by PVE-Automate. Do not edit.', true, true);
		note += formatForVersion('----------', false, true);
		totalRAM = 0;
		totalDisk = 0;
		runningRAM = 0;
		systemRAM = 0;

		axios.get(createURL(`cluster/resources`), {
			headers: {
				Authorization: `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`
			}
		}).then((response) => {
			var clusterInfo = response.data.data;

			for (var i = 0; i < clusterInfo.length; i++) {
				let thisInfo = clusterInfo[i];

				if (!thisInfo.node || !thisInfo.type || !thisInfo.maxmem) {
					continue;
				}

				if (thisInfo.node === config.nodeId && thisInfo.type === 'node') {
					systemRAM = Math.round(bytesToMB(thisInfo.maxmem));
					break;
				}
			}

			getLXCInfo().then(() => {
				getVMInfo().then(() => {
					note += formatForVersion(`Running RAM: ${runningRAM}MB (${Math.round(runningRAM / 1024 * 100) / 100}GB)`, false, true);
					note += formatForVersion(`Total RAM: ${totalRAM}MB (${Math.round(totalRAM / 1024 * 100) / 100}GB)`, false, true);
					note += formatForVersion(`System RAM: ${systemRAM}MB (${Math.round(systemRAM / 1024 * 100) / 100}GB)`, false, true);
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
		}).catch((err) => {
			console.error('Failed to fetch cluster information');
			console.error(err);
		});

		function getLXCInfo() {
			return new Promise((resolve, reject) => {
				axios.get(createURL(`nodes/${config.nodeId}/lxc`), {
					headers: {
						Authorization: `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`
					}
				}).then((response) => {
					note += formatVMData(response.data.data, 'Containers');
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
					note += formatVMData(response.data.data, 'VMs');
					resolve();
				}).catch((err) => {
					reject(new Error(`${err.response.status}: ${err.response.statusText}`));
				});
			});
		}

		function formatVMData(data, type) {
			var output = '';

			output += formatForVersion(`${type}`, false, true);
			output += formatForVersion('==========', true, true);
			output += formatForVersion('ID (Name) CPU RAM Disk [Status]', false, true);
			output += formatForVersion('----------', true, true);

			var vms = [];
			for (var i = 0; i < data.length; i++) {
				let thisVM = data[i];

				if (thisVM.template === 1) continue;

				vms.push(`${thisVM.vmid} (${thisVM.name}) ${thisVM.cpus} ${bytesToMB(thisVM.maxmem)}MB ${Math.round(bytesToGB(thisVM.maxdisk) * 100) / 100}GB [${thisVM.status}]\n\n`);
				totalRAM += bytesToMB(thisVM.maxmem);
				totalDisk += bytesToGB(thisVM.maxdisk);

				if (thisVM.status === 'running') {
					runningRAM += bytesToMB(thisVM.maxmem);
				}
			}

			vms.sort();
			output += vms.join('');

			if (shouldEscape) {
				output += '\n\n---\n\n';
			} else {
				output += '----------\n\n';
			}

			return output;
		}
	});
}).catch((err) => {
	console.error('Failed to get PVE version');
	console.error(err);
});