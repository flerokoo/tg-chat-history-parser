
const fs = require("fs");
const cheerio = require("cheerio");
const path = require("path");
const argv = require("yargs")
    .string("historyDir")
    .string("outFile")
    .boolean("cleanupNames")
    .argv;


const flattenReduce = (acc, cur) => {
    return acc.concat(cur)
};

const sortByDate = (a,b) => a.date > b.date

const parseDate = str => {
    if (!str) return null;
    let result = str.match(/([\d]+)\.([\d]+)\.([\d]+) ([\d]+):([\d]+):([\d]+)/);
    if (!result) return null;
    let date = new Date(result[3], result[2] - 1, result[1], result[4], result[5], result[6]);
    return date;
}

let extractMessages = content => {
    let $ = cheerio.load(content);
    let $messages = $(".message");
    let out = [];

    let lastFrom = null;
    let lastDate = null;

    $messages.each((i, el) => {
        let $el = cheerio(el);
        
        let from = $el.find(".from_name").text().trim().toLowerCase();
        let dateRaw = $el.find(".date").attr("title");
        let date = parseDate(dateRaw);
        let text = $el.find(".text").text();

        if (argv.cleanupNames === true) {
            // strip forwarded from part
            from = from.replace(/via .+/ig, "");            
            from = from.replace(/\n(.+)/ig, "");
            // strip date that is occasianly appears in nicknames field
            from = from.replace(/[\d]{2}\.[\d]{2}\.[\d]{4}[\s]+[\d]{2}:[\d]{2}:[\d]{2}/ig, "");
            from = from.trim();
        }

        if (!from) from = lastFrom;
        if (!date) date = lastDate;

        // skip service messages
        if (from && date) {
            out.push({ from, date, text });
        }
        
        lastFrom = from;
        lastDate = date;
    });

    return out;
}


if (!argv.historyDir || !fs.existsSync(argv.historyDir)
    || !fs.statSync(argv.historyDir).isDirectory()) {
    throw new Error("historyDir argument is not provided or it is not a directory")
}

let parsed = fs.readdirSync(argv.historyDir)
    .filter(name => name.startsWith("messages"))
    .map(name => fs.readFileSync(path.join(argv.historyDir, name)).toString())
    .map(extractMessages)
    .reduce(flattenReduce)
    .sort(sortByDate);

fs.writeFileSync(argv.outFile || "parsed.json", JSON.stringify(parsed, null, 3));
console.log(`Parsed messages: ${parsed.length}`)
