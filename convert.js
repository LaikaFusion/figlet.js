(fs = require("fs")), (fontDir = __dirname + "/fonts/");
var figFonts = {};
var FULL_WIDTH = 0,
  FITTING = 1,
  SMUSHING = 2,
  CONTROLLED_SMUSHING = 3;

function getSmushingRules(oldLayout, newLayout) {
  var rules = {};
  var val, index, len, code;
  var codes = [
    [16384, "vLayout", SMUSHING],
    [8192, "vLayout", FITTING],
    [4096, "vRule5", true],
    [2048, "vRule4", true],
    [1024, "vRule3", true],
    [512, "vRule2", true],
    [256, "vRule1", true],
    [128, "hLayout", SMUSHING],
    [64, "hLayout", FITTING],
    [32, "hRule6", true],
    [16, "hRule5", true],
    [8, "hRule4", true],
    [4, "hRule3", true],
    [2, "hRule2", true],
    [1, "hRule1", true]
  ];

  val = newLayout !== null ? newLayout : oldLayout;
  index = 0;
  len = codes.length;
  while (index < len) {
    code = codes[index];
    if (val >= code[0]) {
      val = val - code[0];
      rules[code[1]] =
        typeof rules[code[1]] === "undefined" ? code[2] : rules[code[1]];
    } else if (code[1] !== "vLayout" && code[1] !== "hLayout") {
      rules[code[1]] = false;
    }
    index++;
  }

  if (typeof rules["hLayout"] === "undefined") {
    if (oldLayout === 0) {
      rules["hLayout"] = FITTING;
    } else if (oldLayout === -1) {
      rules["hLayout"] = FULL_WIDTH;
    } else {
      if (
        rules["hRule1"] ||
        rules["hRule2"] ||
        rules["hRule3"] ||
        rules["hRule4"] ||
        rules["hRule5"] ||
        rules["hRule6"]
      ) {
        rules["hLayout"] = CONTROLLED_SMUSHING;
      } else {
        rules["hLayout"] = SMUSHING;
      }
    }
  } else if (rules["hLayout"] === SMUSHING) {
    if (
      rules["hRule1"] ||
      rules["hRule2"] ||
      rules["hRule3"] ||
      rules["hRule4"] ||
      rules["hRule5"] ||
      rules["hRule6"]
    ) {
      rules["hLayout"] = CONTROLLED_SMUSHING;
    }
  }

  if (typeof rules["vLayout"] === "undefined") {
    if (
      rules["vRule1"] ||
      rules["vRule2"] ||
      rules["vRule3"] ||
      rules["vRule4"] ||
      rules["vRule5"]
    ) {
      rules["vLayout"] = CONTROLLED_SMUSHING;
    } else {
      rules["vLayout"] = FULL_WIDTH;
    }
  } else if (rules["vLayout"] === SMUSHING) {
    if (
      rules["vRule1"] ||
      rules["vRule2"] ||
      rules["vRule3"] ||
      rules["vRule4"] ||
      rules["vRule5"]
    ) {
      rules["vLayout"] = CONTROLLED_SMUSHING;
    }
  }

  return rules;
}

const convertToJSON = (fontName, data) => {
  data = data.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  figFonts[fontName] = {};

  var lines = data.split("\n");
  var headerData = lines.splice(0, 1)[0].split(" ");
  var figFont = figFonts[fontName];
  var opts = {};

  opts.hardBlank = headerData[0].substr(5, 1);
  opts.height = parseInt(headerData[1], 10);
  opts.baseline = parseInt(headerData[2], 10);
  opts.maxLength = parseInt(headerData[3], 10);
  opts.oldLayout = parseInt(headerData[4], 10);
  opts.numCommentLines = parseInt(headerData[5], 10);
  opts.printDirection =
    headerData.length >= 6 ? parseInt(headerData[6], 10) : 0;
  opts.fullLayout = headerData.length >= 7 ? parseInt(headerData[7], 10) : null;
  opts.codeTagCount =
    headerData.length >= 8 ? parseInt(headerData[8], 10) : null;
  opts.fittingRules = getSmushingRules(opts.oldLayout, opts.fullLayout);

  figFont.options = opts;

  // error check
  if (
    opts.hardBlank.length !== 1 ||
    isNaN(opts.height) ||
    isNaN(opts.baseline) ||
    isNaN(opts.maxLength) ||
    isNaN(opts.oldLayout) ||
    isNaN(opts.numCommentLines)
  ) {
    throw new Error(`${fontName} header contains invalid values.`);
  }

  /*
            All FIGlet fonts must contain chars 32-126, 196, 214, 220, 228, 246, 252, 223
        */

  var charNums = [],
    ii;
  for (ii = 32; ii <= 126; ii++) {
    charNums.push(ii);
  }
  charNums = charNums.concat(196, 214, 220, 228, 246, 252, 223);

  // error check - validate that there are enough lines in the file
  if (lines.length < opts.numCommentLines + opts.height * charNums.length) {
    throw new Error("FIGlet file is missing data.");
  }

  /*
            Parse out the context of the file and put it into our figFont object
        */

  var cNum,
    endCharRegEx,
    parseError = false;

  figFont.comment = lines.splice(0, opts.numCommentLines).join("\n");
  figFont.numChars = 0;

  while (lines.length > 0 && figFont.numChars < charNums.length) {
    cNum = charNums[figFont.numChars];
    figFont[cNum] = lines.splice(0, opts.height);
    // remove end sub-chars
    for (ii = 0; ii < opts.height; ii++) {
      if (typeof figFont[cNum][ii] === "undefined") {
        figFont[cNum][ii] = "";
      } else {
        endCharRegEx = new RegExp(
          "\\" +
            figFont[cNum][ii].substr(figFont[cNum][ii].length - 1, 1) +
            "+$"
        );
        figFont[cNum][ii] = figFont[cNum][ii].replace(endCharRegEx, "");
      }
    }
    figFont.numChars++;
  }

  /*
            Now we check to see if any additional characters are present
        */

  while (lines.length > 0) {
    cNum = lines.splice(0, 1)[0].split(" ")[0];
    if (/^0[xX][0-9a-fA-F]+$/.test(cNum)) {
      cNum = parseInt(cNum, 16);
    } else if (/^0[0-7]+$/.test(cNum)) {
      cNum = parseInt(cNum, 8);
    } else if (/^[0-9]+$/.test(cNum)) {
      cNum = parseInt(cNum, 10);
    } else if (/^-0[xX][0-9a-fA-F]+$/.test(cNum)) {
      cNum = parseInt(cNum, 16);
    } else {
      if (cNum === "") {
        break;
      }
      // something's wrong
      console.log("Invalid data:" + cNum);
      parseError = true;
      break;
    }

    figFont[cNum] = lines.splice(0, opts.height);
    // remove end sub-chars
    for (ii = 0; ii < opts.height; ii++) {
      if (typeof figFont[cNum][ii] === "undefined") {
        figFont[cNum][ii] = "";
      } else {
        endCharRegEx = new RegExp(
          "\\" +
            figFont[cNum][ii].substr(figFont[cNum][ii].length - 1, 1) +
            "+$"
        );
        figFont[cNum][ii] = figFont[cNum][ii].replace(endCharRegEx, "");
      }
    }
    figFont.numChars++;
  }

  // error check
  if (parseError === true) {
    throw new Error("Error parsing data.");
  }
  return figFonts[fontName];
};

fs.readdir(fontDir, async (err, files) => {
  await Promise.all(
    files.map(async file => {
      fs.readFile(fontDir + file, { encoding: "utf-8" }, function(
        err,
        fontData
      ) {
        if (err) {
          return console.log(err);
        }

        fontData = fontData + "";
        try {
          fs.writeFile(
            `json/${file.substring(0, file.length - 4)}.json`,
            JSON.stringify(convertToJSON(file, fontData)),
            function(err) {
              if (err) {
                return console.log(err);
              }
              console.log("The file was saved!");
            }
          );
        } catch (error) {
          console.log(error);
        }
      });
    })
  );
});
