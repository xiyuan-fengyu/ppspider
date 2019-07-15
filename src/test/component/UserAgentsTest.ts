import {UserAgents} from "../../common/util/UserAgents";

console.log(UserAgents.random());
console.log(UserAgents.randomByRegex("Windows .* Chrome/[67][0-9]\\."));
