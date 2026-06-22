
async function registerUser(){
let r=await fetch('/register',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({username:u.value,password:p.value})});
msg.innerText=r.ok?'Account Created':'Error';
}
async function loginUser(){
let r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({username:u.value,password:p.value})});
if(r.ok){localStorage.setItem('loggedIn','1');location='pages/dashboard.html';}
else msg.innerText='Invalid Login';
}
