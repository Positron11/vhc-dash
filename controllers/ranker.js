const { body, validationResult } = require("express-validator");

const PRC = require("../models/PRC");
const RCV = require("../models/RCV");


// ranker view
exports.ranker = async (req, res, next) => {
	// find all PRCs not voted for by user
	const prcs = await PRC.aggregate([
		{
			$lookup: {
				from: RCV.collection.name,
				localField: "rcv",
				foreignField: "_id",
				as: "rcv"
			}
		},
		{ $unwind: "$rcv" },
		{ $match: { "rcv.ballots.voter": { $ne: req.user._id } } },
		{ $limit: 1 }
	
	]);
	
	// populate PRC
	const prc = prcs.length ? await PRC.hydrate(prcs[0]).populate("responses.llm") : undefined;
		
	res.render("ranker", {
		title: "M.O. Ranker",
		prc: prc
	});
}


// submit ballot
exports.post_ballot = [
	body("prc").isMongoId(),
	
	body().custom(async (body, { req }) => {
		const prc = await PRC.findById(body.prc);
		
		const validLLMIDs = prc.responses.map(response => response.llm.toString());

		const rankKeys = Object.keys(body).filter(key => key.startsWith("rank-"));
		const statusKeys = Object.keys(body).filter(key => key.startsWith("status-"));

		// make sure no extra/missing rank/status fields
		if (!(rankKeys.length == prc.responses.length || statusKeys.length == prc.responses.length)) {
			throw new Error("No. of rank/status fields does not match no. of PRC responses");
		}
				
		const seenRanks = new Set();
		const rankStatusPairs = [];

		for (let i=0; i < prc.responses.length; i++) {
			const llmID = rankKeys[i].split("-")[1];
			const rankValue = body[rankKeys[i]];
			const statusValue = body[statusKeys[i]];
			
			// ensure rank/status pairs match and LLM IDs are valid
			if (llmID != statusKeys[i].split("-")[1]) throw new Error("Rank/status IDs do not match");
			if (!validLLMIDs.includes(llmID)) throw new Error("Invalid LLM ID");

			// ensure rank values are distinct
			if (seenRanks.has(rankValue)) throw new Error("Rank values are not unique");
			seenRanks.add(rankValue);

			// check if status value is valid
			if (!["pass", "fail"].includes(statusValue)) throw new Error("Invalid status value");

			rankStatusPairs.push({ rank: rankValue, status: statusValue });
		}

		// ensure all fail ranks are below all pass ranks
		const sortedPairs = rankStatusPairs.sort((a, b) => a.rank - b.rank);
		let foundFail = false;

		for (const status of sortedPairs) {
			if (!foundFail && status == "fail") foundFail = true;
			if (foundFail && status == "pass") throw new Error("Fail rank above pass rank");
		}

		return true;
	}),

	async (req, res, next) => {
		const prc = await PRC.findById(req.body.prc)
			.populate("rcv responses.llm");

		const errors = validationResult(req);

		if (!errors.isEmpty()) { 
			(req.session.flash ??= {}).errors = errors.array();
			return res.redirect("/ranker");
		}

		const models = prc.responses.map(response => response.llm._id);
		var ranking = Array(models.length);
		var failCount = 0;

		// insert LLM IDs into ranked positions
		models.forEach(model => {
			ranking[req.body[`rank-${model.toString()}`] - 1] = model;
			if (req.body[`status-${model.toString()}`] == "fail") failCount++;
		});

		// push ballot to associated RCV
		prc.rcv.ballots.push({
			voter: req.user._id,
			ranking: ranking,
			failCount: failCount
		});

		await prc.rcv.save();
		
		return res.redirect("/ranker");
	}
]