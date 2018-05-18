
const jsonp = `callback123({
    "id": 123,
    "name": "Tom"
})`;
const index = jsonp.indexOf('(');
let callback = jsonp.substring(0, index);
const getJsonFromJsonP = `function ${callback}(arg) { return arg; }\n${jsonp}`;
const json = eval(getJsonFromJsonP);
console.log(json);