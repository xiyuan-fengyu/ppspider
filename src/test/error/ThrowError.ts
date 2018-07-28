export function throwError() {
    const error = new Error("test");
    console.log(error.stack.split("\n")[2].trim());
}