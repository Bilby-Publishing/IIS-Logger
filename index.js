const parseXML = require('xml2js').parseStringPromise;
const https = require('https');
const path = require('path');
const fs = require('fs');


require('dotenv').config();


const options = {
	hostname: 'discord.com',
	port: 443,
	path: process.env.web_hook,
	method: 'POST',
	headers: {
		'Content-Type': 'application/json'
	}
};

function InRange(num, min, max) {
	return min <= num && num <= max;
}

function Send(params) {
	const req = https.request(options, (res) => {
		console.log(`statusCode: ${res.statusCode}`);
	});

	req.on('error', (error) => {
		console.error(error);
	});

	req.write(JSON.stringify(params));
	req.end();
}


async function Run(filePath) {
	let data = fs.readFileSync(filePath, "utf8");
	let xml = await parseXML(data);

	let summary = xml.failedRequest['$'];
	if (!summary) {
		console.error(`${filePath}: is not a failed request`);
	}

	let url = new URL(summary.url);

	function GenerateField(evt) {
		console.log(50, evt);
		return {
			"name": evt[0]._,
			"value": evt.slice(1)
				.map(x => `${x['$'].Name}: ${x._}`).join('\n')
		};
	}

	let details = xml.failedRequest.Event
		.filter(x => InRange(Number(x.System[0].Level[0]), 1, 3))
		.map(x => GenerateField(x.EventData[0].Data));

	Send({
		username: "Osage",
		avatar_url: "https://avatars.githubusercontent.com/u/120225958?s=200&v=4",
		content: "",
		embeds: [
			{
				"title": `Error ${summary.statusCode}`,
				"type": "rich",
				"thumbnail": {
					"url": "",
				},
				"url": summary.url,
				"description": `${summary.verb} ${url.pathname+url.search}`,
				"fields": details
			}
		]
	});
}

fs.watch(process.env.log_folder, {}, (evtType,  filename) => {
	console.log(evtType);
	if (evtType === 'rename' && filename) {
		const filePath = path.join(process.env.log_folder, filename);

		fs.stat(filePath, (err, stats) => {
			if (err) {
				return;
			}

			if (stats.isFile()) {
				console.log(`File added: ${filename}`);
				Run(filePath).catch(console.error);
			}
		});
	}
});
console.log("watching for new logs");