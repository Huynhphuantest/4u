const timer = document.body.querySelector("span");
let time = 5;
setInterval(() => {
    time--;
    if(time === -1) {
        document.body.innerHTML = `
        <hehe>Ngu.</hehe>
        `
        return;
    }
    if(time === -2) {
        while(true) {
            console.log("log")
        }
        return;
    }
    if(time === -3) {
        document.body.innerHTML = `
        <hehe>Đu trình duyệt xịn dữ?</hehe>
        `
    }
    if(time === -4) {
        window.location.href = "/"
    }
    timer.innerText = time
}, 1200)