
(async () => {

    function test() {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve("time: 2000");
            }, 2000);

            setTimeout(() => {
                resolve("time: 1000");
            }, 1000);
        });
    }

    console.log(await test());
})();