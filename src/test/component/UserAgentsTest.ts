import {UserAgents} from "../../common/util/UserAgents";

console.log(UserAgents.random());
console.log(UserAgents.randomByRegex("Chrome/[67][0-9]\\."));
