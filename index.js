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
		console.log(`Sent Webhook\n  statusCode: ${res.statusCode}`);
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
		return {
			"name": evt.RenderingInfo[0].Opcode[0],
			"value": "```\n" +
				evt.EventData[0].Data.slice(1)
					.map(x => `${x['$'].Name}: ${x._}`).join('\n') +
				"\n```"
		};
	}

	let events = xml.failedRequest.Event
	let start = new Date(events[0].System[0].TimeCreated[0]['$'].SystemTime);
	let end = new Date(events[events.length-1].System[0].TimeCreated[0]['$'].SystemTime);

	let details = events
		.filter(x => InRange(Number(x.System[0].Level[0]), 1, 3))
		.map(x => GenerateField(x));

	Send({
		username: process.env.device,
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
				"description": `${summary.verb} ${url.pathname+url.search}\n` +
					`Time Taken: \`${end.getTime() - start.getTime()}ms\``,
				"fields": details
			}
		]
	});
}

fs.watch(process.env.log_folder, {}, (evtType,  filename) => {
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

// Run("./sample/fr003743.xml")