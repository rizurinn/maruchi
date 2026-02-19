async function sKata() {
const res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/kbbi.json')
const kbbi = await res.json()
return new Promise((resolve) => {
let huruf = random(['a', 'b', 'c', 'd', 'e', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'u', 'w'])
let data = kbbi.filter(v => v.startsWith(huruf))
resolve({
status: true, kata: random(data)
})
})
}

async function cKata(input) {
const res = await fetch('https://raw.githubusercontent.com/rizurinn/Resource/refs/heads/main/json/kbbi.json')
const kbbi = await res.json()
return new Promise((resolve) => {
if (!kbbi.find(v => v == input.toLowerCase())) return resolve({
status: false
})
resolve({
status: true
})
})
}

function random(list) {
return list[Math.floor(Math.random() * list.length)]
}

export {
sKata,
cKata
}
