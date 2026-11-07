(function(){
  var hero=document.getElementById('hero'), img=document.getElementById('heroImg');
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cart=document.querySelector('.badge'), n=0;

  // soft mouse parallax: photo drifts, florals drift the other way
  if(!reduce && window.matchMedia('(hover:hover)').matches){
    var tx=0,ty=0,cx=0,cy=0;
    hero.addEventListener('mousemove',function(e){
      var r=hero.getBoundingClientRect();
      tx=(e.clientX-r.left)/r.width-.5; ty=(e.clientY-r.top)/r.height-.5;
    });
    hero.addEventListener('mouseleave',function(){tx=0;ty=0});
    (function loop(){
      cx+=(tx-cx)*.06; cy+=(ty-cy)*.06;
      hero.style.setProperty('--px',(cx*-22).toFixed(2)+'px');
      hero.style.setProperty('--py',(cy*-14).toFixed(2)+'px');
      hero.style.setProperty('--fx',(cx*16).toFixed(2)+'px');
      hero.style.setProperty('--fy',(cy*10).toFixed(2)+'px');
      requestAnimationFrame(loop);
    })();
  }

  // cart badge bounce when the cart is clicked (demo count)

  // keep placeholder links from jumping to top
  document.querySelectorAll('a[href="#"]').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault()})});
})();

/* ================= LOGIN / SIGN UP (password based) ================= */
(function(){
  var $=function(s){return document.querySelector(s)};
  /* Orders remain local; customer credentials, sessions, and saved addresses use the PHP/Supabase backend. */
  var mem={},lsOk=true,ckOk=false;
  try{localStorage.setItem('vey_t','1');localStorage.removeItem('vey_t')}catch(e){lsOk=false}
  try{document.cookie='vey_t=1;path=/;max-age=60';ckOk=/vey_t=1/.test(document.cookie)}catch(e){}
  var wn={};try{wn=JSON.parse(window.name.indexOf('veyDB:')===0?window.name.slice(6):'{}')||{}}catch(e){wn={}}
  function ckGet(k){var m=document.cookie.match(new RegExp('(?:^|; )'+k+'=([^;]*)'));return m?decodeURIComponent(m[1]):null}
  function ckSet(k,j){document.cookie=k+'='+encodeURIComponent(j)+';path=/;max-age=31536000;SameSite=Lax'}
  var store={
    get:function(k,d){
      var raw=null;
      try{if(lsOk)raw=localStorage.getItem(k)}catch(e){}
      if(raw==null&&ckOk){try{raw=ckGet('vey_'+k)}catch(e){}}
      if(raw==null&&wn[k]!=null)raw=wn[k];
      if(raw==null)raw=mem[k];
      try{var v=JSON.parse(raw);return v==null?d:v}catch(e){return d}
    },
    set:function(k,v){var j=JSON.stringify(v);mem[k]=j;
      if(lsOk){try{localStorage.setItem(k,j)}catch(e){lsOk=false}}
      if(ckOk){try{if(j.length<3500)ckSet('vey_'+k,j);else document.cookie='vey_'+k+'=;path=/;max-age=0;SameSite=Lax'}catch(e){}}
      wn[k]=j;try{window.name='veyDB:'+JSON.stringify(wn)}catch(e){}
    }
  };
  var auth=$('#auth'),mode='login',afterAuth=null;
  var users=store.get('vey_profiles',{}),session=null,csrfToken='',authAvailable=false;
  var oldUsers=store.get('vey_users',{});
  Object.keys(oldUsers).forEach(function(email){
    var u=oldUsers[email]||{};
    if(!users[email])users[email]={name:u.name||'',phone:u.phone||'',orders:u.orders||[]};
  });
  Object.keys(users).forEach(function(email){if(users[email])delete users[email].addresses});
  saveUsers();store.set('vey_users',{});store.set('vey_session',null);

  /* SHA-256 remains available to the separate demo admin login; customer passwords use PHP password_hash. */
  function sha256(str){
    var K=[],H=[],i,j,w=[],p=0,isP={};
    for(var c=2;p<64;c++){if(!isP[c]){for(i=0;i<313;i+=c)isP[i]=c;H[p]=(Math.pow(c,.5)*4294967296)|0;K[p++]=(Math.pow(c,1/3)*4294967296)|0}}
    var m=unescape(encodeURIComponent(str))+'\x80',l=m.length,n=((l+7)>>6)+1,W=[];
    for(i=0;i<n*16;i++)W[i]=0;
    for(i=0;i<l;i++)W[i>>2]|=m.charCodeAt(i)<<(24-(i%4)*8);
    W[(l-1+8>>2)|0]=W[(l-1+8>>2)|0];
    W[n*16-1]=(l-1)*8;
    var h=H.slice(0,8);
    for(var o=0;o<n*16;o+=16){
      var a=h.slice(0);
      for(j=0;j<64;j++){
        if(j<16)w[j]=W[o+j];
        else{var g=w[j-15],d=w[j-2];w[j]=(w[j-16]+(((g>>>7)|(g<<25))^((g>>>18)|(g<<14))^(g>>>3))+w[j-7]+(((d>>>17)|(d<<15))^((d>>>19)|(d<<13))^(d>>>10)))|0}
        var e=a[4],t1=(a[7]+(((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)))+((e&a[5])^(~e&a[6]))+K[j]+w[j])|0;
        var q=a[0],t2=((((q>>>2)|(q<<30))^((q>>>13)|(q<<19))^((q>>>22)|(q<<10)))+((q&a[1])^(q&a[2])^(a[1]&a[2])))|0;
        a=[(t1+t2)|0,q,a[1],a[2],(a[3]+t1)|0,e,a[5],a[6]];
      }
      for(j=0;j<8;j++)h[j]=(h[j]+a[j])|0;
    }
    return h.map(function(x){return('00000000'+(x>>>0).toString(16)).slice(-8)}).join('');
  }
  var toastT;function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show')},2600)}
  function setSessionUser(user){
    session=user.email.toLowerCase();
    var profile=users[session]||{orders:[]};
    profile.name=user.name;profile.email=session;profile.orders=profile.orders||[];
    users[session]=profile;store.set('vey_profiles',users);paint();
  }
  var authError='Authentication is unavailable. Check the PHP server and Supabase configuration.';
  function updateAuthWarning(){
    var warning=$('#authWarn');
    if(location.protocol==='file:'){
      warning.textContent='Authentication requires the PHP server. Start it from the project folder, configure Supabase in .env, then open the site through the PHP server URL.';
      warning.hidden=false;
    }else{
      warning.textContent=authError;
      warning.hidden=authAvailable;
    }
  }
  function readAuthResponse(response){
    return response.text().then(function(text){
      var data;
      try{data=JSON.parse(text)}catch(_){
        if(/^\s*<\?php\b/i.test(text)){
          throw new Error('The server returned PHP source instead of running the auth API. Start PHP in the project folder with `php -S 127.0.0.1:8000` and open http://127.0.0.1:8000; do not use Live Server.');
        }
        throw new Error('The authentication API did not return JSON. Open the site through the PHP server and check its error log.');
      }
      if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('The authentication API returned an invalid response.');
      if(!response.ok){
        var error=new Error(data.error||'Authentication failed.');
        error.code=data.code||'';
        throw error;
      }
      return data;
    });
  }
  function authRequest(payload){
    return authReady.then(function(){
      if(!authAvailable)throw new Error(authError);
      return fetch('api/auth.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(payload)})
        .then(readAuthResponse).then(function(data){
          if(data.csrf)csrfToken=data.csrf;
          return data;
        });
    });
  }
  var authReady=fetch('api/auth.php',{credentials:'same-origin',cache:'no-store'}).then(function(response){
    return readAuthResponse(response).then(function(data){csrfToken=data.csrf||'';authAvailable=true;if(data.user){setSessionUser(data.user);setTimeout(syncOrders,0)}else paint()});
  }).catch(function(error){
    authAvailable=false;
    if(location.protocol==='file:')authError='Open the site through the PHP server URL and configure Supabase in the project .env file.';
    else if(error instanceof TypeError)authError='Could not reach the PHP authentication API. Start the PHP server from the project folder and open the site through its URL.';
    else authError=error.message||authError;
    session=null;paint();updateAuthWarning();
  });

  /* open / close */
  function open(m){updateAuthWarning();setMode(m||'login',true);auth.classList.add('show');auth.setAttribute('aria-hidden','false');setTimeout(function(){var f=$(mode==='login'?'#lEmail':'#sName');f&&f.focus()},350)}
  function close(){afterAuth=afterAuth&&auth.classList.contains('show')&&!(session&&users[session])?null:afterAuth;auth.classList.remove('show');auth.setAttribute('aria-hidden','true')}
  $('#authClose').onclick=close;
  auth.addEventListener('mousedown',function(e){if(e.target===auth)close()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){close();$('#umenu').classList.remove('show')}});

  /* tabs / swap links */
  function setMode(m,instant){
    mode=m;var login=m==='login';
    $('#authTabs').classList.toggle('signup',!login);
    [].forEach.call(document.querySelectorAll('#authTabs button'),function(b){b.classList.toggle('on',b.dataset.mode===m)});
    $('#authTitle').textContent=login?'Welcome back':'Create your account';
    $('#authSub').textContent=login?'Log in with your email and password.':'Join Veylora with your email and a password.';
    var lf=$('#loginForm'),sf=$('#signupForm');
    lf.hidden=!login;sf.hidden=login;
    var f=login?lf:sf;f.classList.remove('in');void f.offsetWidth;if(!instant)f.classList.add('in');
    $('#lErr').textContent='';$('#sErr').textContent='';
  }
  [].forEach.call(document.querySelectorAll('#authTabs button'),function(b){b.onclick=function(){setMode(b.dataset.mode)}});
  [].forEach.call(document.querySelectorAll('.swap a'),function(a){a.onclick=function(e){e.preventDefault();setMode(a.dataset.mode)}});

  /* show / hide password */
  [].forEach.call(document.querySelectorAll('.eye'),function(b){b.onclick=function(){
    var i=document.getElementById(b.dataset.eye),show=i.type==='password';i.type=show?'text':'password';b.classList.toggle('on',show);b.setAttribute('aria-label',show?'Hide password':'Show password');
  }});

  /* strength meter */
  var cols=['#d9534f','#e8963c','#d8b83a','#4f9d69'];
  function strength(p){var s=0;if(p.length>=8)s++;if(/[a-z]/.test(p)&&/[A-Z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^A-Za-z0-9]/.test(p)||p.length>=12)s++;return s}
  $('#sPass').addEventListener('input',function(){
    var s=this.value?Math.max(1,strength(this.value)):0,bars=document.querySelectorAll('#meter i');
    bars.forEach(function(b,i){b.style.background=i<s?cols[s-1]:''});
    $('#hint').textContent=!this.value?'Use 8+ characters with letters and numbers; maximum 72 bytes.':['','Weak','Fair','Good','Strong'][s]+' password';
  });

  function fail(id,msg,fields){
    var e=$(id);e.innerHTML=msg;e.classList.remove('shake');void e.offsetWidth;e.classList.add('shake');
    (fields||[]).forEach(function(f){f.classList.add('bad')});
    // make sure the person actually sees what went wrong (small phone screens)
    try{e.scrollIntoView({block:'center',behavior:'smooth'})}catch(_){}
    if(fields&&fields[0])try{fields[0].focus({preventScroll:true})}catch(_){}

  }
  [].forEach.call(document.querySelectorAll('.aform input'),function(i){i.addEventListener('input',function(){i.classList.remove('bad')})});
  var emailOk=function(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)};

  /* ---------- SIGN UP ---------- */
  var suBusy=false;
  $('#signupBtn').addEventListener('click',function(e){e.preventDefault();doSignup()});
  $('#signupForm').addEventListener('submit',function(e){e.preventDefault();doSignup()});
  function doSignup(){
    if(suBusy)return;
    var n=$('#sName'),em=$('#sEmail'),p=$('#sPass'),p2=$('#sPass2');
    var name=n.value.trim(),email=em.value.trim().toLowerCase();
    if(name.length<2)return fail('#sErr','Please enter your full name.',[n]);
    if(!emailOk(email))return fail('#sErr','Please enter a valid email address.',[em]);
    if(new Blob([p.value]).size>72)return fail('#sErr','Password must not exceed 72 bytes.',[p]);
    if(p.value.length<8||!/[A-Za-z]/.test(p.value)||!/\d/.test(p.value))return fail('#sErr','Password needs 8+ characters with letters and numbers.',[p]);
    if(p.value!==p2.value)return fail('#sErr','Passwords do not match.',[p2]);
    suBusy=true;$('#signupBtn').disabled=true;
    authReady.then(function(){return authRequest({action:'signup',name:name,email:email,password:p.value})}).then(function(data){
      if(data.user){setSessionUser(data.user);syncOrders();toast('Account created. Welcome, '+name.split(' ')[0]+'!')}
      else toast(data.message||'Account created. Check your email to confirm your address, then log in.');
      close();
      $('#signupForm').reset();document.querySelectorAll('#meter i').forEach(function(b){b.style.background=''});
      if(data.user&&afterAuth){var f=afterAuth;afterAuth=null;setTimeout(f,450)}
    }).catch(function(error){
      if(error.code==='email_taken')fail('#sErr','This email is already registered. <a href="#" id="goLogin">Log in instead</a>',[em]);
      else fail('#sErr',error.message||'Could not create your account. Please try again.');
    }).then(function(){suBusy=false;$('#signupBtn').disabled=false});
  }
  document.addEventListener('click',function(e){if(e.target.id==='goLogin'){e.preventDefault();var v=$('#sEmail').value;setMode('login');$('#lEmail').value=v;$('#lPass').focus()}if(e.target.id==='goSignup'){e.preventDefault();var v2=$('#lEmail').value;setMode('signup');$('#sEmail').value=v2;$('#sName').focus()}});

  /* ---------- LOG IN ---------- */
  $('#loginForm').addEventListener('submit',function(e){
    e.preventDefault();
    var em=$('#lEmail'),p=$('#lPass'),email=em.value.trim().toLowerCase();
    if(!emailOk(email))return fail('#lErr','Please enter a valid email address.',[em]);
    if(!p.value)return fail('#lErr','Please enter your password.',[p]);
    var submit=$('#loginForm button[type=submit]');submit.disabled=true;
    authReady.then(function(){return authRequest({action:'login',email:email,password:p.value})}).then(function(data){
      setSessionUser(data.user);syncOrders();close();toast('Welcome back, '+data.user.name.split(' ')[0]+'!');$('#loginForm').reset();
      if(afterAuth){var f=afterAuth;afterAuth=null;setTimeout(f,450)}
    }).catch(function(error){
      if(error.code==='invalid_credentials')fail('#lErr','Email or password is incorrect. <a href="#" id="goSignup">Sign up</a>',[p]);
      else fail('#lErr',error.message||'Could not log in. Please try again.');
    }).then(function(){submit.disabled=false});
  });

  /* ---------- session / header ---------- */
  function logout(){
    authReady.then(function(){return authRequest({action:'logout'})}).then(function(data){
      session=null;paint();$('#umenu').classList.remove('show');toast('You have been logged out');
      if(data.warning)toast(data.warning);
    }).catch(function(error){toast(error.message||'Could not log out. Please try again.')});
  }
  function paint(){
    var u=session&&users[session];
    $('#signinLabel').textContent=u?u.name.split(' ')[0]:'Sign In';
    $('#uname').textContent=u?u.name:'';
    $('#umail').textContent=u?session:'';
  }
  $('#signinBtn').addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    if(session&&users[session])$('#umenu').classList.toggle('show');else open('login');
  });
  $('#logoutBtn').onclick=logout;
  document.addEventListener('click',function(e){if(!e.target.closest('#umenu,#signinBtn'))$('#umenu').classList.remove('show')});
  paint();

  /* ---------- ADDRESS BOOK + ORDER ---------- */
  var ad=$('#addr'),adSel=null,adCtx=null,adNew=false,adPay='COD',addresses=[],addressBusy=false;
  /* UPI details shown at checkout. To change the QR code, replace the image inside #payUpi. */
  var UPI={id:'mehraankita897@okhdfcbank',name:'Ankita Mehra'};
  function me(){return session&&users[session]}
  function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function money(n){return '₹'+Number(n).toLocaleString('en-IN')}
  function addrText(a){return a.line+', '+a.city+', '+a.state+' - '+a.pin+(a.landmark?' (Near '+a.landmark+')':'')}
  function saveUsers(){
    var persisted=JSON.parse(JSON.stringify(users));
    Object.keys(persisted).forEach(function(email){
      var profile=persisted[email];
      if(!profile)return;
      delete profile.addresses;
      (profile.orders||[]).forEach(function(order){if(order)delete order.address});
    });
    store.set('vey_profiles',persisted);
  }
  function addressFromApi(a){return{id:a.id,name:a.full_name,phone:a.mobile_number,line:a.address_line,city:a.city,state:a.state,pin:a.pincode,landmark:a.landmark||''}}
  function addressPayload(a){return{full_name:a.name,mobile_number:a.phone,address_line:a.line,city:a.city,state:a.state,pincode:a.pin,landmark:a.landmark||''}}
  function addressRequest(method,data,id){
    return authReady.then(function(){
      if(!authAvailable)throw new Error(authError);
      var url='/api/addresses.php'+(id?'?id='+encodeURIComponent(id):''),headers={'X-CSRF-Token':csrfToken},options={method:method,credentials:'same-origin',headers:headers};
      if(data){headers['Content-Type']='application/json';options.body=JSON.stringify(data)}
      return fetch(url,options).then(function(response){return response.json().catch(function(){return{error:'The server returned an invalid response.'}}).then(function(result){
        if(result.csrf)csrfToken=result.csrf;
        if(!response.ok){var error=new Error(result.error||'Could not update your addresses.');error.code=result.code||'';throw error}
        return result;
      })});
    });
  }
  function orderRequest(method,data){
    return authReady.then(function(){
      if(!authAvailable)throw new Error(authError);
      var headers={},options={method:method,credentials:'same-origin',headers:headers};
      if(method!=='GET'){
        headers['Content-Type']='application/json';
        headers['X-CSRF-Token']=csrfToken;
        options.body=JSON.stringify(data);
      }
      return fetch('api/orders.php',options).then(function(response){
        return response.text().then(function(text){
          var result;
          try{result=JSON.parse(text)}catch(_){throw new Error('The order API returned an invalid response. Start the PHP server and run database/schema.sql in Supabase.')}
          if(result.csrf)csrfToken=result.csrf;
          if(!response.ok){var error=new Error(result.error||'Could not save your order.');error.code=result.code||'';throw error}
          return result;
        });
      });
    });
  }
  function orderFromApi(row){
    var method=row.payment_method;
    return{
      id:row.order_number,
      dbId:row.id,
      date:Date.parse(row.created_at),
      items:(row.items||[]).map(function(item){return{name:item.name,type:item.type,size:item.size,price:Number(item.price),qty:Number(item.qty)}}),
      total:Number(row.total_price),
      addressId:row.address_id,
      pay:{method:method,status:row.payment_status,utr:row.utr||'',amount:Number(row.total_price)},
      status:row.status,
      history:[{s:row.status,t:Date.parse(row.created_at)}]
    };
  }
  function refreshOrders(){
    return orderRequest('GET').then(function(result){
      if(!me())return;
      var persisted=me().orders||[];
      var localOnly=persisted.filter(function(order){return !order.dbId});
      me().orders=(result.orders||[]).map(orderFromApi).concat(localOnly);
      saveUsers();
    });
  }
  function syncOrders(){
    refreshOrders().catch(function(error){console.error('Could not load saved orders:',error)});
  }
  function clearAddressForm(){
    [].forEach.call(document.querySelectorAll('#addrForm input,#addrForm textarea'),function(x){x.value='';x.classList.remove('bad')});
  }
  function adOpen(ctx){
    if(!me()){open('login');return}
    adCtx=ctx||null;addresses=[];adSel=null;adNew=!!adCtx;
    $('#addrOk').hidden=true;$('#addrPay').hidden=true;$('#addrMain').hidden=false;adPay='COD';
    ad.classList.add('show');ad.setAttribute('aria-hidden','false');
    $('#addrList').textContent='Loading your saved addresses…';
    $('#addrForm').hidden=!adNew;
    if(adNew)$('#aName').value=me().name||'';
    addressRequest('GET').then(function(data){
      addresses=(data.addresses||[]).map(addressFromApi);
      adSel=addresses.length?addresses[0].id:null;adNew=adNew||!addresses.length;
      adPaint();
    }).catch(function(error){
      addresses=[];adNew=true;adPaint();
      aFail(error.message||'Could not load your saved addresses. Please try again.');
    });
  }
  function adClose(){ad.classList.remove('show');ad.setAttribute('aria-hidden','true')}
  function adPaint(){
    var u=me(),L=addresses,co=!!adCtx;
    $('#addrTitle').textContent=co?'Delivery address':'My addresses';
    $('#addrSub').textContent=co?'Choose where to deliver your order, or add a new address.':'Save the addresses you want to use for your orders.';
    var sum=$('#addrSum');sum.hidden=!co;
    if(co)sum.innerHTML='<span>'+adCtx.count+' '+(adCtx.count===1?'item':'items')+'</span><b>Total '+money(adCtx.total)+' &middot; Free shipping</b>';
    $('#addrList').innerHTML=L.map(function(a){return '<div class="a-opt'+(co&&a.id===adSel?' on':'')+'" data-id="'+esc(a.id)+'">'+(co?'<i></i>':'')+'<div><b>'+esc(a.name)+' &middot; '+esc(a.phone)+'</b>'+esc(addrText(a))+'</div><button type="button" class="del" data-del="'+esc(a.id)+'">Remove</button></div>'}).join('');
    var showForm=adNew||!L.length;
    $('#addrForm').hidden=!showForm;
    $('#aNewBtn').hidden=showForm;
    $('#aPlaceRow').hidden=!(co&&!showForm&&L.length);
    $('#aCancel').hidden=!(L.length&&showForm);
    $('#aSave').textContent=co?'Save & Continue':'Save address';
    if(showForm){
      if(!$('#aName').value)$('#aName').value=u.name||'';
    }
    $('#aErr').textContent='';
  }
  function aFail(msg,el){var e=$('#aErr');e.textContent=msg;e.classList.remove('shake');void e.offsetWidth;e.classList.add('shake');
    [].forEach.call(document.querySelectorAll('#addrForm input,#addrForm textarea'),function(x){x.classList.remove('bad')});
    if(el){el.classList.add('bad');try{el.focus({preventScroll:true})}catch(_){}}
    try{e.scrollIntoView({block:'center',behavior:'smooth'})}catch(_){}
    return false}
  function readForm(){
    var g=function(id){return $(id).value.trim()};
    var a={name:g('#aName'),phone:g('#aPhone').replace(/\D/g,''),line:g('#aLine'),city:g('#aCity'),state:g('#aState'),pin:g('#aPin').replace(/\D/g,''),landmark:g('#aLand')};
    if(a.name.length<2)return aFail('Please enter the receiver\'s full name.',$('#aName'));
    if(!/^[6-9]\d{9}$/.test(a.phone))return aFail('Please enter a valid 10-digit mobile number.',$('#aPhone'));
    if(a.line.length<6)return aFail('Please enter your house no. and street / area.',$('#aLine'));
    if(a.city.length<2)return aFail('Please enter your city.',$('#aCity'));
    if(a.state.length<2)return aFail('Please enter your state.',$('#aState'));
    if(!/^\d{6}$/.test(a.pin))return aFail('Please enter a valid 6-digit pincode.',$('#aPin'));
    return a}
  function aSave(){
    if(addressBusy)return;
    var a=readForm();if(!a)return;
    addressBusy=true;$('#aSave').disabled=true;
    addressRequest('POST',addressPayload(a)).then(function(result){
      var saved=addressFromApi(result.address);
      addresses.unshift(saved);
      adSel=saved.id;adNew=false;clearAddressForm();
      if(adCtx){payOpen()}else{adPaint();toast('Address saved')}
    }).catch(function(error){
      aFail(error.message||'Could not save your address. Please try again.');
    }).then(function(){addressBusy=false;$('#aSave').disabled=false});
  }
  function money2(n){return Number(n).toFixed(2)}
  function payPaint(){
    var upi=adPay==='UPI';
    [].forEach.call(document.querySelectorAll('#payOpts .a-opt'),function(o){o.classList.toggle('on',o.dataset.pm===adPay)});
    $('#payUpi').hidden=!upi;
    $('#payGo').textContent=upi?'I\'ve Paid \u2013 Place Order':'Place Order';
    $('#payErr').textContent='';$('#payUtr').classList.remove('bad');
  }
  function payOpen(){
    var u=me(),a=addresses.filter(function(x){return x.id===adSel})[0];
    if(!a){toast('Please choose a delivery address');return}
    adPay='COD';$('#payUtr').value='';
    $('#paySum').innerHTML='<span>'+adCtx.count+' '+(adCtx.count===1?'item':'items')+' &middot; deliver to '+esc(a.name)+', '+esc(a.city)+'</span><b>Total '+money(adCtx.total)+'</b>';
    $('#payAmt').textContent=money(adCtx.total);
    $('#payName').textContent=UPI.name;$('#payId').textContent=UPI.id;
    var app=$('#payApp');
    app.href='upi://pay?pa='+UPI.id+'&pn='+encodeURIComponent(UPI.name)+'&am='+money2(adCtx.total)+'&cu=INR&tn='+encodeURIComponent('Veylora order');
    app.hidden=!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    $('#addrMain').hidden=true;$('#addrPay').hidden=false;payPaint();
    try{$('#addr .addr-card').scrollTop=0}catch(_){}
  }
  function payGo(){
    if(adPay==='UPI'){
      var t=$('#payUtr'),v=t.value.replace(/\s/g,'');
      if(!/^\d{12}$/.test(v)){
        var e=$('#payErr');e.textContent='Please enter the 12-digit UPI reference number (UTR) shown in your payment app after paying.';
        e.classList.remove('shake');void e.offsetWidth;e.classList.add('shake');t.classList.add('bad');
        try{t.focus({preventScroll:true})}catch(_){}
        return;
      }
    }
    place();
  }
  var orderBusy=false;
  function place(){
    if(orderBusy)return;
    var u=me(),a=addresses.filter(function(x){return x.id===adSel})[0];
    if(!a){toast('Please choose a delivery address');return}
    var upi=adPay==='UPI',utr=upi?$('#payUtr').value.replace(/\s/g,''):'';
    orderBusy=true;$('#payGo').disabled=true;$('#payErr').textContent='';
    orderRequest('POST',{
      address_id:a.id,
      items:adCtx.items,
      payment_method:upi?'UPI':'COD',
      utr:upi?utr:null
    }).then(function(result){
      var order=orderFromApi(result.order),oid=order.id;
      order.address=a;
      u.orders=u.orders||[];u.orders.unshift(order);saveUsers();
      var done=adCtx.done;adCtx=null;
      var lines=order.items.map(function(i){return '\u2022 '+i.name+' (Size '+i.size+') x'+i.qty+' - '+money(i.price*i.qty)}).join('\n');
      var payLine=upi?'UPI - paid '+money(order.total)+' (UTR '+utr+')':'Cash on Delivery - '+money(order.total)+' to pay on delivery';
      var msg='Hi Veylora, I have placed an order.\n\n*Order ID:* '+oid+'\n'+lines+'\n*Total:* '+money(order.total)+'\n*Payment:* '+payLine+'\n\n*Deliver to:* '+a.name+', '+a.phone+'\n'+addrText(a);
      $('#addrMain').hidden=true;$('#addrPay').hidden=true;var ok=$('#addrOk');ok.hidden=false;
      var payNote=upi?'<p>We have received your UPI reference number <b>'+esc(utr)+'</b> and will confirm your payment shortly.</p>':'<p>Please keep <b>'+money(order.total)+'</b> ready in cash when your order is delivered.</p>';
      ok.innerHTML='<div class="tick">\u2713</div><h3>Order placed!</h3><span class="oid">'+esc(oid)+'</span>'+
        '<p>Thank you, '+esc(u.name.split(' ')[0])+'. We will deliver to<br><b>'+esc(a.name)+'</b>, '+esc(addrText(a))+'.</p>'+payNote+
        '<p>Tap below to send your order details to Aisha on WhatsApp so we can confirm it quickly.</p>'+
        '<div class="a-act"><a class="btn-primary" target="_blank" rel="noopener" href="https://wa.me/918427314999?text='+encodeURIComponent(msg)+'">Send order on WhatsApp</a><button type="button" class="ghost" id="aDone">Continue shopping</button></div>';
      if(done)done();
    }).catch(function(error){
      $('#payErr').textContent=error.message||'Could not save your order. Please try again.';
    }).then(function(){orderBusy=false;$('#payGo').disabled=false});
  }
  $('#addrClose').onclick=adClose;
  ad.addEventListener('mousedown',function(e){if(e.target===ad)adClose()});
  document.addEventListener('click',function(e){if(e.target.id==='aDone')adClose()});
  $('#aSave').addEventListener('click',function(e){e.preventDefault();aSave()});
  $('#addrForm').addEventListener('submit',function(e){e.preventDefault();aSave()});
  $('#aNewBtn').onclick=function(){clearAddressForm();adNew=true;adPaint()};
  $('#aCancel').onclick=function(){clearAddressForm();adNew=false;adPaint()};
  $('#aPlace').onclick=payOpen;
  $('#payOpts').addEventListener('click',function(e){var o=e.target.closest('[data-pm]');if(o){adPay=o.dataset.pm;payPaint();if(adPay==='UPI'){try{$('#payUpi').scrollIntoView({block:'nearest',behavior:'smooth'})}catch(_){}}}});
  $('#payGo').onclick=payGo;
  $('#payBack').onclick=function(){$('#addrPay').hidden=true;$('#addrMain').hidden=false;adPaint()};
  $('#payCopy').onclick=function(){
    var done=function(){toast('UPI ID copied')};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(UPI.id).then(done,function(){toast('Long-press the UPI ID to copy it')})}
    else{try{var r=document.createRange();r.selectNodeContents($('#payId'));var sel=getSelection();sel.removeAllRanges();sel.addRange(r);document.execCommand('copy');sel.removeAllRanges();done()}catch(_){toast('Long-press the UPI ID to copy it')}}
  };
  $('#payUtr').addEventListener('input',function(){this.classList.remove('bad')});
  $('#addrList').addEventListener('click',function(e){
    var d=e.target.closest('[data-del]');
    if(d){
      if(addressBusy)return;
      addressBusy=true;d.disabled=true;
      addressRequest('DELETE',null,d.dataset.del).then(function(){
        addresses=addresses.filter(function(a){return a.id!==d.dataset.del});
        if(adSel===d.dataset.del)adSel=addresses.length?addresses[0].id:null;
        if(adEditId===d.dataset.del){adEditId=null;clearAddressForm()}
        if(!addresses.length)adNew=true;
        adPaint();
      }).catch(function(error){aFail(error.message||'Could not remove the address. Please try again.')})
        .then(function(){addressBusy=false});
      return;
    }
    var o=e.target.closest('.a-opt');if(o&&adCtx){adSel=o.dataset.id;adPaint()}
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')adClose()});
  $('#addrBtn').onclick=function(){$('#umenu').classList.remove('show');adOpen(null)};
  /* checkout from the cart: log in (or sign up) first, then pick / add an address */
  function checkout(sum){
    if(me()){adOpen(sum);return}
    afterAuth=function(){adOpen(sum)};open('login');toast('Log in or create an account to place your order');
  }

  window.veyAuth={users:function(){return users},save:saveUsers,reload:function(){users=store.get('vey_profiles',{})},sha:sha256,open:open,checkout:checkout,isIn:function(){return !!(session&&users[session])}};
})();


/* ================= PAGE ROUTER + CURTAIN TRANSITION ================= */
(function(){
  var $=function(s){return document.querySelector(s)};
  var pages={home:$('#hero'),about:$('#about'),collections:$('#collections'),shop:$('#shop'),contact:$('#contact')};
  function fitHero(){var h=$('#hero');if(!h)return;
    var s=(window.innerWidth>900&&window.innerWidth>=window.innerHeight)?Math.max(.55,Math.min(1,window.innerHeight/860)):1;
    h.style.setProperty('--hz',s.toFixed(3));
  }
  fitHero();window.addEventListener('resize',fitHero);
  var curtain=$('#curtain'),c1=$('.c1'),c2=$('.c2'),cl=$('.cl');
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur='home',busy=false,ease='cubic-bezier(.77,0,.18,1)';

  // florals for the About page are copied from the home page
  var ab=$('#about');
  ['.f-bl','.f-br'].forEach(function(s){var n=$(s).cloneNode(true);n.classList.add('af');ab.insertBefore(n,ab.firstChild)});

  function paintNav(v){
    [].forEach.call(document.querySelectorAll('.nav a'),function(a){a.classList.toggle('active',a.dataset.view===v)});
  }
  function swap(v,again){
    cur=v;
    Object.keys(pages).forEach(function(k){pages[k].hidden=k!==v});
    pages.home.classList.toggle('again',v==='home'&&!!again);
    window.scrollTo(0,0);paintNav(v);
    try{history.replaceState(null,'','#'+v)}catch(e){try{location.hash=v}catch(_){}}
    document.title={about:'About Us – Veylora',collections:'Collections – Veylora',shop:'Shop – Veylora',contact:'Contact Us – Veylora',home:'Veylora – Fashion Beyond Borders'}[v];
  }
  function go(v){
    if(busy||v===cur)return;
    if(reduce){swap(v,true);return}
    busy=true;
    var order={home:0,about:1,collections:2,shop:3,contact:4};var d=order[v]>order[cur]?1:-1;               // sweep direction
    var from='translateX('+(-100*d)+'%)',to='translateX('+(100*d)+'%)',zero='translateX(0)';
    curtain.classList.add('on','run');
    var a1=c1.animate([{transform:from},{transform:zero}],{duration:800,easing:ease,fill:'forwards'});
    var a2=c2.animate([{transform:from},{transform:zero}],{duration:800,delay:170,easing:ease,fill:'forwards'});
    cl.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:600,delay:650,easing:'ease-out',fill:'forwards'});
    a2.finished.then(function(){
      return new Promise(function(r){setTimeout(r,650)});   // let the logo breathe
    }).then(function(){
      swap(v,true);
      cl.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'});
      var b2=c2.animate([{transform:zero},{transform:to}],{duration:900,easing:ease,fill:'forwards'});
      c1.animate([{transform:zero},{transform:to}],{duration:900,delay:170,easing:ease,fill:'forwards'}).finished.then(function(){
        c1.getAnimations().concat(c2.getAnimations(),cl.getAnimations()).forEach(function(x){x.cancel()});
        curtain.classList.remove('on','run');busy=false;
      });
    });
  }

  document.addEventListener('click',function(e){
    var a=e.target.closest('[data-view]');
    if(a){e.preventDefault();go(a.dataset.view)}
  });
  $('#joinLaunch').addEventListener('click',function(e){
    e.preventDefault();
    if(window.veyAuth&&veyAuth.isIn()){var t=$('#toast');t.textContent="You're already on the launch list!";t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2600)}
    else if(window.veyAuth)veyAuth.open('signup');
  });
  window.addEventListener('hashchange',function(){var v=location.hash.slice(1);if(pages[v])go(v)});
  function ctLink(){
    var nm=$('#ctName').value.trim(),oc=$('#ctOcc').value.trim(),ms=$('#ctMsg').value.trim();
    var t='Hi Aisha, I am contacting you from the Veylora website.\n\n*Name:* '+nm+(oc?'\n*Occasion:* '+oc:'')+'\n*Message:* '+ms;
    $('#ctSend').href='https://wa.me/918427314999?text='+encodeURIComponent(t);
  }
  ['#ctName','#ctOcc','#ctMsg'].forEach(function(q){$(q).addEventListener('input',ctLink)});
  $('#ctSend').addEventListener('click',function(e){
    ctLink();
    var n=$('#ctName'),m=$('#ctMsg');
    if(!n.value.trim()||!m.value.trim()){
      e.preventDefault();(n.value.trim()?m:n).focus();
      toast('Please add your name and a message for Aisha');
    }
  });
  $('#ctForm').addEventListener('submit',function(e){e.preventDefault();$('#ctSend').click()});
  // call buttons: tel: links open the phone's dial pad natively; a copy sheet is offered too
  var cs=$('#ctCall'),csT;
  function copyNum(){
    var n='+918427314999',done=function(){var b=$('#ctCopy');b.textContent='Copied \u2713';setTimeout(function(){b.textContent='Copy number'},1800)};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(n).then(done,fb)}else fb();
    function fb(){var t=document.createElement('textarea');t.value=n;t.style.cssText='position:fixed;opacity:0';document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(_){}t.remove();done()}
  }
  function showCall(){cs.classList.add('show');clearTimeout(csT);csT=setTimeout(function(){cs.classList.remove('show')},9000)}
  document.addEventListener('click',function(e){
    if(e.target.closest('a[href^="tel:"]'))showCall();   // no preventDefault: the dial pad opens
    if(e.target.closest('#ctCopy,[data-copy]'))copyNum();
    if(e.target.closest('#ctCallX'))cs.classList.remove('show');
  });
  var h0=location.hash.slice(1);if(pages[h0]&&h0!=='home'){swap(h0,false)}
})();

/* ================= COLLECTION: products, details, cart ================= */
(function(){
  var $=function(s){return document.querySelector(s)}, $$=function(s){return [].slice.call(document.querySelectorAll(s))};
  var fmt=function(n){return '₹'+n.toLocaleString('en-IN')};
  var store={get:function(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}},set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
  var toastT;function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show')},2600)}
  var SIZES=['S','M','L','XL','XXL'];

  /* ---- products (edit names, prices and details here) ---- */
  var P=[
   {id:1,img:'images/product-1.jpg',pos:'50% 20%',name:'Midnight Bandhani Cape Set',cat:'Indo-Western',mrp:7999,price:5599,color:'Black & Ivory',fabric:'Crepe skirt, printed silk cape',includes:'Crop top, draped skirt, bandhani cape',occasion:'Festive, Cocktail',desc:'A fluid black draped skirt and sweetheart crop top, finished with a statement bandhani-print cape that moves with every step.'},
   {id:2,img:'images/product-2.jpg',pos:'50% 25%',name:'Sage Mirror-Work Sharara Set',cat:'Sharara & Palazzo',mrp:8999,price:6749,color:'Sage Gold',fabric:'Tissue silk, organza dupatta',includes:'Halter blouse, flared sharara, dupatta',occasion:'Sangeet, Mehendi',desc:'A mirror-embroidered halter blouse paired with shimmering wide-flare sharara pants and a floaty mint organza dupatta.'},
   {id:3,img:'images/product-3.jpg',pos:'50% 15%',name:'Jade Zari Palazzo Set',cat:'Sharara & Palazzo',mrp:5999,price:4499,color:'Jade Green',fabric:'Crushed tissue, zari work',includes:'Embroidered top, palazzo, dupatta',occasion:'Festive, Day events',desc:'A softly embroidered top with a draped dupatta and breezy zari palazzos, easy to wear from morning puja to evening get-togethers.'},
   {id:4,img:'images/product-4.jpg',pos:'50% 30%',name:'Sky Drape Skirt & Cape Set',cat:'Indo-Western',mrp:6499,price:4549,color:'Sky Blue',fabric:'Organza, hand-embellished',includes:'Embellished crop top, draped skirt, cape',occasion:'Engagement, Cocktail',desc:'A cascading draped skirt with a sheer floating cape and a sparkling embellished crop top. Made to catch the light and the breeze.'},
   {id:5,img:'images/product-5.jpg',pos:'50% 25%',name:'Wine Patchwork Lehenga',cat:'Lehenga',mrp:11999,price:9599,color:'Wine & Gold',fabric:'Dola silk, sequin and thread work',includes:'Draped blouse, flared lehenga',occasion:'Wedding, Festive',desc:'A twirl-ready patchwork lehenga in rich wine, with a heavily embroidered border and a gathered blouse with a golden panel.'},
   {id:6,img:'images/product-6.jpg',pos:'50% 25%',name:'Noir Floral Cape Set',cat:'Indo-Western',mrp:7499,price:5999,color:'Black & Beige',fabric:'Georgette, sequin top',includes:'Sequin crop top, ruched skirt, printed cape',occasion:'Party, Cocktail',desc:'A sequinned black crop top, ruched skirt and a flowing floral cape. Bold, glamorous and made for the evening.'},
   {id:7,img:'images/product-7.jpg',pos:'50% 18%',name:'Crimson Stripe Lehenga',cat:'Lehenga',mrp:9499,price:6999,color:'Crimson',fabric:'Georgette, zari stripes',includes:'Embroidered blouse, flared lehenga, dupatta',occasion:'Wedding guest, Festive',desc:'A deep crimson lehenga with fine zari stripes that shimmer as you move, paired with a mirror-detail blouse and a matching drape.'},
   {id:8,img:'images/product-8.jpg',pos:'50% 22%',name:'Olive Slit Anarkali Set',cat:'Kurta & Anarkali',mrp:4999,price:3499,color:'Olive Green',fabric:'Georgette, sequin embroidery',includes:'Slit kurta, palazzo, dupatta',occasion:'Festive, Day events',desc:'A graceful olive anarkali-style kurta with a centre slit, lattice sequin work and a flowing dupatta that moves beautifully.'},
   {id:9,img:'images/product-9.jpg',pos:'50% 25%',name:'Forest Embroidered Kurta Set',cat:'Kurta & Anarkali',mrp:3999,price:2999,color:'Forest Green',fabric:'Silk blend, thread embroidery',includes:'Embroidered kurta, trousers, dupatta',occasion:'Festive, Pooja',desc:'A rich forest-green kurta with a detailed yoke and scattered motifs, with slim trousers and an embroidered-edge dupatta.'},
   {id:10,img:'images/product-10.jpg',pos:'50% 20%',name:'Powder Blue Peplum Sharara Set',cat:'Sharara & Palazzo',mrp:8499,price:6799,color:'Powder Blue',fabric:'Crinkle georgette, zari work',includes:'Peplum top, sharara, dupatta',occasion:'Sangeet, Engagement',desc:'A delicate powder-blue peplum top with shimmering motifs, matched with crinkled flared sharara pants and a sheer dupatta.'},
   {id:11,img:'images/product-11.jpg',pos:'50% 25%',name:'Sky Blue Sequin Anarkali',cat:'Kurta & Anarkali',mrp:6999,price:5249,color:'Sky Blue',fabric:'Net with sequin borders',includes:'Anarkali gown, dupatta',occasion:'Engagement, Festive',desc:'A sweeping sky-blue anarkali in soft net, scattered with sequins and finished with a glittering border.'}
  ];
  var ORIG=P.slice();
  var CAT=store.get('vey_catalog',null);if(!CAT||!CAT.added)CAT={added:[],removed:[],next:100};
  function calcOff(p){p.off=p.mrp>p.price?Math.round((1-p.price/p.mrp)*100):0}
  function applyCat(){P.length=0;CAT.added.forEach(function(p){P.push(p)});ORIG.forEach(function(p){if(CAT.removed.indexOf(p.id)<0)P.push(p)});P.forEach(calcOff)}
  function saveCat(){try{localStorage.setItem('vey_catalog',JSON.stringify(CAT));return true}catch(e){return false}}
  applyCat();
  var byId=function(id){return P.filter(function(p){return p.id==id})[0]};

  /* ---- state ---- */
  var cart=store.get('vey_cart2',[]), wish=store.get('vey_wish',[]);
  var st={cat:'All',sort:'featured'}, list=P.slice();
  function tidy(){cart=cart.filter(function(c){return byId(c.id)});wish=wish.filter(function(id){return byId(id)});store.set('vey_cart2',cart);store.set('vey_wish',wish)}
  tidy();
  var heart='<svg viewBox="0 0 24 24"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/></svg>';

  /* ---- grid ---- */
  function visible(){
    var l=P.filter(function(p){return st.cat==='All'||p.cat===st.cat});
    if(st.sort==='az')l.sort(function(a,b){return a.name.localeCompare(b.name)});
    if(st.sort==='za')l.sort(function(a,b){return b.name.localeCompare(a.name)});
    return l;
  }
  function render(re){
    list=visible();var g=$('#pgrid');g.classList.toggle('re',!!re);
    $('#countTxt').textContent=list.length+(list.length===1?' look':' looks');
    g.innerHTML=!list.length?'<p style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text)">New looks are arriving soon.</p>':list.map(function(p,i){return '<article class="pcard" style="--i:'+i+'" data-id="'+p.id+'">'+
      '<div class="pimg" data-open><img src="'+p.img+'" alt="'+p.name+'" style="object-position:'+p.pos+'"><span class="lno">No. '+(P.indexOf(p)<9?'0':'')+(P.indexOf(p)+1)+'</span>'+
      '<button class="heart'+(wish.indexOf(p.id)>-1?' on':'')+'" data-wish aria-label="Add to wishlist">'+heart+'</button>'+
      '<div class="lcap"><span class="pcat">'+p.cat+'</span><h4 data-open>'+p.name+'</h4><span class="lview">View the look <i>&rarr;</i></span></div></div></article>'}).join('');
  }
  $('#chips').addEventListener('click',function(e){var b=e.target.closest('.chip');if(!b)return;st.cat=b.dataset.cat;$$('.chip').forEach(function(c){c.classList.toggle('on',c===b)});render(true)});
  $('#sortSel').addEventListener('change',function(){st.sort=this.value;render(true)});

  $('#pgrid').addEventListener('click',function(e){
    var card=e.target.closest('.pcard');if(!card)return;var id=+card.dataset.id;
    var sz=e.target.closest('[data-size]');
    if(sz){addToCart(id,sz.dataset.size,1,card.querySelector('.pimg img'));card.classList.remove('picking');return}
    if(e.target.closest('[data-wish]')){toggleWish(id,e.target.closest('[data-wish]'));return}
    if(e.target.closest('[data-add]')){var was=card.classList.contains('picking');$$('.pcard.picking').forEach(function(c){c.classList.remove('picking')});if(!was)card.classList.add('picking');return}
    if(e.target.closest('[data-open]')){list=visible();openPM(id)}
  });
  function toggleWish(id,btn){
    var i=wish.indexOf(id);if(i>-1){wish.splice(i,1);toast('Removed from wishlist')}else{wish.push(id);toast('Saved to wishlist')}
    store.set('vey_wish',wish);
    $$('.pcard[data-id="'+id+'"] .heart, .scard[data-id="'+id+'"] .heart').forEach(function(h){h.classList.toggle('on',wish.indexOf(id)>-1)});
    var ph=$('#pmHeart');if(ph&&pm.id==id)ph.classList.toggle('on',wish.indexOf(id)>-1);
    if(btn){btn.classList.remove('beat');void btn.offsetWidth;btn.classList.add('beat')}
  }

  /* ---- cart ---- */
  function addToCart(id,size,qty,srcImg){
    var f=cart.filter(function(c){return c.id===id&&c.size===size})[0];
    if(f)f.qty+=qty;else cart.push({id:id,size:size,qty:qty});
    saveCart();if(srcImg)fly(srcImg);
    toast('Added to cart · '+byId(id).name+' (Size '+size+')');
  }
  function fly(img){
    var cartEl=$('.cart');if(!cartEl)return;
    var r=img.getBoundingClientRect(),t=cartEl.getBoundingClientRect();if(!r.width)return;
    var c=document.createElement('img');c.src=img.src;
    c.style.cssText='position:fixed;z-index:300;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px;object-fit:cover;border-radius:18px;pointer-events:none;box-shadow:0 14px 34px rgba(60,15,28,.35)';
    document.body.appendChild(c);
    var dx=t.left+t.width/2-(r.left+r.width/2),dy=t.top+t.height/2-(r.top+r.height/2);
    var a=c.animate([{transform:'none',opacity:1},{transform:'translate('+dx*.5+'px,'+(dy*.5-60)+'px) scale(.4)',opacity:.95,offset:.55},{transform:'translate('+dx+'px,'+dy+'px) scale(.04)',opacity:.2}],{duration:850,easing:'cubic-bezier(.5,0,.4,1)'});
    a.onfinish=function(){c.remove();var b=$('.badge');b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop')};
  }
  function saveCart(){store.set('vey_cart2',cart);renderCart()}
  function renderCart(){
    var qty=cart.reduce(function(s,c){return s+c.qty},0);
    $('.badge').textContent=qty;
    var body=$('#cdBody');
    if(!cart.length){body.innerHTML='<div class="cd-empty"><svg viewBox="0 0 24 24" fill="none" stroke="#c7868f" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h3l2.6 12.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 7H6"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/></svg><p>Your cart is empty</p><a href="#collections" data-view="collections" class="cd-go">Browse the collection</a></div>';$('#cdFoot').style.display='none';return}
    $('#cdFoot').style.display='';
    var sub=0,mrp=0;
    body.innerHTML=cart.map(function(c,i){var p=byId(c.id);sub+=p.price*c.qty;mrp+=p.mrp*c.qty;
      return '<div class="ci"><img src="'+p.img+'" alt="" style="object-position:'+p.pos+'"><div><h5>'+p.name+'</h5><small>Size '+c.size+'</small><div class="ci-p"><b>'+fmt(p.price)+'</b>'+(p.off?' <s>'+fmt(p.mrp)+'</s>':'')+'</div>'+
      '<div class="qty"><button data-dec="'+i+'" aria-label="Decrease">−</button><span>'+c.qty+'</span><button data-inc="'+i+'" aria-label="Increase">+</button></div></div><button class="rm" data-rm="'+i+'">Remove</button></div>'}).join('');
    $('#cdSub').textContent=fmt(sub);$('#cdSave').textContent=fmt(mrp-sub);$('#cdTotal').textContent=fmt(sub);
  }
  $('#cdBody').addEventListener('click',function(e){
    var t=e.target;
    if(t.dataset.inc!==undefined)cart[+t.dataset.inc].qty++;
    else if(t.dataset.dec!==undefined){var c=cart[+t.dataset.dec];c.qty--;if(c.qty<1)cart.splice(+t.dataset.dec,1)}
    else if(t.dataset.rm!==undefined)cart.splice(+t.dataset.rm,1);
    else return;
    saveCart();
  });
  function openCart(){$('#cdrawer').classList.add('open');$('#cscrim').classList.add('show')}
  function closeCart(){$('#cdrawer').classList.remove('open');$('#cscrim').classList.remove('show')}
  $('.cart').addEventListener('click',function(e){e.preventDefault();openCart()});
  $('#cdClose').onclick=closeCart;$('#cscrim').onclick=closeCart;
  document.addEventListener('click',function(e){if(e.target.closest('.cd-go'))closeCart()});
  $('#checkoutBtn').onclick=function(){
    if(!cart.length)return;
    var items=cart.map(function(c){var p=byId(c.id);return{name:p.name,type:p.cat,size:c.size,qty:c.qty,price:p.price}});
    var total=items.reduce(function(t,i){return t+i.price*i.qty},0),count=items.reduce(function(t,i){return t+i.qty},0);
    closeCart();
    veyAuth.checkout({items:items,total:total,count:count,done:function(){cart=[];saveCart()}});
  };

  /* ---- product details modal ---- */
  var pm={id:null,size:null,qty:1};
  function openPM(id){
    var p=byId(id);pm={id:id,size:null,qty:1};
    var img=$('#pmImg img');img.src=p.img;img.alt=p.name;img.style.objectPosition=p.pos;
    $('#pmImg').classList.remove('zoom');img.style.transformOrigin='50% 50%';
    $('#pmOff').textContent=p.off+'% OFF';$('#pmOff').style.display=p.off?'':'none';
    $('#pmInfo').innerHTML=
     '<span class="pcat">'+p.cat+'</span><h3>'+p.name+'</h3>'+
     '<div class="pm-price"><b>'+fmt(p.price)+'</b>'+(p.off?'<s>'+fmt(p.mrp)+'</s><em>'+p.off+'% off</em>':'')+'</div>'+
     '<p class="tax">Inclusive of all taxes.'+(p.off?' You save '+fmt(p.mrp-p.price)+'.':'')+'</p>'+
     '<p class="pm-desc">'+p.desc+'</p>'+
     '<dl class="pm-dl"><div><dt>Colour</dt><dd>'+p.color+'</dd></div><div><dt>Fabric</dt><dd>'+p.fabric+'</dd></div><div><dt>Includes</dt><dd>'+p.includes+'</dd></div><div><dt>Occasion</dt><dd>'+p.occasion+'</dd></div><div><dt>Care</dt><dd>Dry clean only</dd></div></dl>'+
     '<div class="pm-size"><div class="pm-lab"><b>Select size</b><span id="sizeErr"></span></div><div class="pm-sizes" id="pmSizes">'+SIZES.map(function(s){return '<button type="button" data-s="'+s+'">'+s+'</button>'}).join('')+'</div></div>'+
     '<div class="pm-buy"><div class="qty big"><button id="qDec" aria-label="Decrease">−</button><span id="qVal">1</span><button id="qInc" aria-label="Increase">+</button></div>'+
     '<button class="btn-primary" id="pmAdd" type="button">Add to Cart</button>'+
     '<button class="heart wide'+(wish.indexOf(id)>-1?' on':'')+'" id="pmHeart" aria-label="Add to wishlist">'+heart+'</button></div>'+
     '<ul class="pm-perks"><li>Free shipping</li><li>Easy returns</li><li>Secure checkout</li></ul>';
    $('#pm').classList.add('show');$('#pm').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
    $('#pmInfo').scrollTop=0;
  }
  function closePM(){$('#pm').classList.remove('show');$('#pm').setAttribute('aria-hidden','true');document.body.style.overflow=''}
  function step(d){var i=0;list.forEach(function(p,k){if(p.id===pm.id)i=k});openPM(list[(i+d+list.length)%list.length].id)}
  $('#pmClose').onclick=closePM;$('#pmPrev').onclick=function(){step(-1)};$('#pmNext').onclick=function(){step(1)};
  $('#pm').addEventListener('mousedown',function(e){if(e.target===this)closePM()});
  $('#pmImg').addEventListener('click',function(){this.classList.toggle('zoom')});
  $('#pmImg').addEventListener('mousemove',function(e){if(!this.classList.contains('zoom'))return;var r=this.getBoundingClientRect();this.querySelector('img').style.transformOrigin=((e.clientX-r.left)/r.width*100)+'% '+((e.clientY-r.top)/r.height*100)+'%'});
  $('#pmInfo').addEventListener('click',function(e){
    var s=e.target.closest('[data-s]');
    if(s){pm.size=s.dataset.s;$$('#pmSizes button').forEach(function(b){b.classList.toggle('on',b===s)});$('#sizeErr').textContent='';return}
    if(e.target.id==='qInc'){pm.qty=Math.min(10,pm.qty+1);$('#qVal').textContent=pm.qty}
    if(e.target.id==='qDec'){pm.qty=Math.max(1,pm.qty-1);$('#qVal').textContent=pm.qty}
    if(e.target.closest('#pmHeart'))toggleWish(pm.id,e.target.closest('#pmHeart'));
    if(e.target.id==='pmAdd'){
      if(!pm.size){var er=$('#sizeErr');er.textContent='Please choose a size';var box=$('#pmSizes');box.classList.remove('shake');void box.offsetWidth;box.classList.add('shake');return}
      addToCart(pm.id,pm.size,pm.qty,$('#pmImg img'));
    }
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){closePM();closeCart()}
    if($('#pm').classList.contains('show')){if(e.key==='ArrowRight')step(1);if(e.key==='ArrowLeft')step(-1)}
  });
  // close the overlays when moving to another page
  document.addEventListener('click',function(e){if(e.target.closest('[data-view]')){closePM();closeCart()}});

  var mq=$('#about .marquee');if(mq)$('#collMarquee').innerHTML=mq.innerHTML;
  render(false);renderCart();
  var WORDS=['No','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'];
  function refresh(){
    applyCat();tidy();
    var cs=document.querySelector('.coll-sub');
    if(cs){if(!cs.dataset.o)cs.dataset.o=cs.textContent;var n=P.length;
      cs.textContent=n===11?cs.dataset.o:(n===0?'New looks are arriving soon.':(WORDS[n]||n)+' handpicked '+(n===1?'look':'looks')+' for the modern woman. Tap a look to see it up close.')}
    render(true);renderCart();
    if(window.veyShop&&window.veyShop.onRefresh)window.veyShop.onRefresh();
  }
  var CATAPI={
    add:function(p){p.id=CAT.next++;calcOff(p);CAT.added.unshift(p);if(!saveCat()){CAT.added.shift();CAT.next--;return false}applyCat();return true},
    remove:function(id){var i=-1;CAT.added.forEach(function(p,k){if(p.id===id)i=k});if(i>-1)CAT.added.splice(i,1);else if(CAT.removed.indexOf(id)<0)CAT.removed.push(id);saveCat();applyCat();return true},
    restore:function(){CAT.removed=[];saveCat();applyCat()},
    removed:function(){return CAT.removed.length},
    bytes:function(){try{return JSON.stringify(CAT).length}catch(e){return 0}}
  };
  window.veyShop={P:P,cat:CATAPI,refresh:refresh,fmt:fmt,addToCart:addToCart,openPM:openPM,toggleWish:toggleWish,isWish:function(id){return wish.indexOf(id)>-1},setList:function(l){list=l}};
})();


/* ================= SHOP PAGE ================= */
(function(){
  var S=window.veyShop;if(!S)return;
  var $=function(s){return document.querySelector(s)}, $$=function(s){return [].slice.call(document.querySelectorAll(s))};
  var P=S.P,fmt=S.fmt,SIZES=['S','M','L','XL','XXL'];
  var tone={1:'Black',2:'Green',3:'Green',4:'Blue',5:'Red & Wine',6:'Black',7:'Red & Wine',8:'Green',9:'Green',10:'Blue',11:'Blue'};
  var hex={1:'#1f1a1c',2:'#b7bfa0',3:'#5fa58f',4:'#6fb0dc',5:'#7a2f42',6:'#2b2427',7:'#b0243a',8:'#7f8f5c',9:'#3f4a25',10:'#a9c8dc',11:'#9ccbe8'};
  var groupHex={'Black':'#1f1a1c','Green':'#6f9a74','Blue':'#7db3dc','Red & Wine':'#9b2d44'};
  var OCC=['Wedding','Festive','Sangeet','Party','Engagement'];
  var occLabel={Wedding:'Wedding',Festive:'Festive',Sangeet:'Sangeet & Mehendi',Party:'Cocktail & Party',Engagement:'Engagement'};
  function derive(){P.forEach(function(p){
    var o=p.occasion||'',t=[];
    if(/Wedding/.test(o))t.push('Wedding');if(/Festive|Pooja|Day/.test(o))t.push('Festive');
    if(/Sangeet|Mehendi/.test(o))t.push('Sangeet');if(/Cocktail|Party/.test(o))t.push('Party');if(/Engagement/.test(o))t.push('Engagement');
    p.tone=tone[p.id]||p.tone;p.hex=hex[p.id]||p.hex;p.occ=t;
  });}derive();
  var MIN=2000,MAX=10000;
  function bounds(){var lo=2000,hi=10000;P.forEach(function(p){lo=Math.min(lo,Math.floor(p.price/100)*100);hi=Math.max(hi,Math.ceil(p.price/100)*100)});MIN=lo;MAX=hi;var a=$('#pMin'),b=$('#pMax');a.min=b.min=lo;a.max=b.max=hi}
  bounds();
  var f={cat:'All',q:'',min:MIN,max:MAX,col:null,occ:[],disc:false,sort:'featured',view:'grid'};
  var heart='<svg viewBox="0 0 24 24"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/></svg>';
  var eye='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var list=[];

  /* sidebar parts */
  var cats=['All','Lehenga','Indo-Western','Sharara & Palazzo','Kurta & Anarkali'];
  function side(){$('#fCats').innerHTML=cats.map(function(c){var n=c==='All'?P.length:P.filter(function(p){return p.cat===c}).length;return '<button type="button" class="fcat'+(c==='All'?' on':'')+'" data-c="'+c+'"><span>'+(c==='All'?'All Outfits':c)+'</span><em>'+n+'</em></button>'}).join('');}side();
  $('#fCols').innerHTML=Object.keys(groupHex).map(function(g){return '<button type="button" class="sw" data-col="'+g+'" title="'+g+'" aria-label="'+g+'" style="--c:'+groupHex[g]+'"></button>'}).join('');
  $('#fOcc').innerHTML=OCC.map(function(o){return '<button type="button" class="ot" data-o="'+o+'">'+occLabel[o]+'</button>'}).join('');
  $('#sCount').innerHTML='<b id="sNum">'+P.length+'</b> <span id="sWord">outfits</span>';

  /* smart search: forgives spelling (lehnga, lehanga), plurals and word order */
  var ALIAS=[[/^(lehn?g?a|leh[ae]n?g?[ah]+|lah[ae]n?g?[ah]+|lengh?a|lehnga|ghagh?ra|chaniya)$/,'lehenga'],[/^(sh?arara|shrara|gharara)$/,'sharara'],[/^(palazo|palazzo|palaazo|pant|pants|trouser)$/,'palazzo'],[/^(anarkli|anarkally|anarkalli|anarkali|gown)$/,'anarkali'],[/^(kurti|kurta|kurtas|kurtis|suit|salwar)$/,'kurta'],[/^(indowestern|indo|western|fusion|cape|crop)$/,'indo-western']];
  function tokens(q){return q.toLowerCase().replace(/[^a-z0-9 &-]/g,' ').split(/\s+/).filter(Boolean).map(function(t){
    var b=t.length>3?t.replace(/(es|s)$/,''):t;
    for(var i=0;i<ALIAS.length;i++)if(ALIAS[i][0].test(t)||ALIAS[i][0].test(b))return ALIAS[i][1];
    return b})}
  function searchMatch(p,q){
    var tk=tokens(q);if(!tk.length)return true;
    var hay=(p.name+' '+p.cat+' '+p.color+' '+p.tone+' '+(p.fabric||'')+' '+(p.includes||'')+' '+(p.occasion||'')).toLowerCase();
    return tk.every(function(t){return hay.indexOf(t)>-1})}
  function countFor(q){return P.filter(function(p){return searchMatch(p,q)}).length}
  window.veySearch={count:countFor,run:function(q){clearAll();f.q=(q||'').trim();sync();render(true)}};

  function active(){return f.cat!=='All'||f.q||f.min>MIN||f.max<MAX||f.col||f.occ.length||f.disc}
  function visible(){
    var l=P.filter(function(p){
      if(f.cat!=='All'&&p.cat!==f.cat)return false;
      if(!searchMatch(p,f.q))return false;
      if(p.price<f.min||p.price>f.max)return false;
      if(f.col&&p.tone!==f.col)return false;
      if(f.occ.length&&!f.occ.some(function(o){return p.occ.indexOf(o)>-1}))return false;
      if(f.disc&&p.off<25)return false;
      return true;
    });
    if(f.sort==='low')l.sort(function(a,b){return a.price-b.price});
    if(f.sort==='high')l.sort(function(a,b){return b.price-a.price});
    if(f.sort==='disc')l.sort(function(a,b){return b.off-a.off});
    return l;
  }
  function tick(n){
    var el=$('#sNum'),from=+el.textContent||0,t0=performance.now();
    (function step(t){var k=Math.min(1,(t-t0)/500);el.textContent=Math.round(from+(n-from)*k);if(k<1)requestAnimationFrame(step)})(t0);
    $('#sWord').textContent=n===1?'outfit':'outfits';
  }
  function render(re){
    list=visible();S.setList(list);
    var g=$('#sgrid');g.classList.toggle('re',!!re);g.classList.toggle('list',f.view==='list');
    tick(list.length);$('#sClearInline').hidden=!active();
    if(!list.length){g.innerHTML='<div class="sempty"><svg viewBox="0 0 24 24" fill="none" stroke="#c7868f" stroke-width="1.3" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg><h4>No outfits match</h4><p>Try a wider price range or remove a filter.</p><button type="button" class="btn-primary" data-clear>Clear all filters</button></div>';return}
    g.innerHTML=list.map(function(p,i){return '<article class="scard" style="--i:'+i+'" data-id="'+p.id+'">'+
      '<div class="simg" data-open><img src="'+p.img+'" alt="'+p.name+'" style="object-position:'+p.pos+'">'+(p.off?'<span class="off">'+p.off+'% OFF</span>':'')+
      '<button class="heart'+(S.isWish(p.id)?' on':'')+'" data-wish aria-label="Add to wishlist">'+heart+'</button><span class="sview">Quick view</span></div>'+
      '<div class="sbody"><div class="srow"><span class="pcat">'+p.cat+'</span><span class="dot-c" title="'+p.color+'" style="background:'+p.hex+'"></span></div>'+
      '<h4 data-open>'+p.name+'</h4><p class="sdesc">'+p.desc+'</p>'+
      '<div class="pprice"><b>'+fmt(p.price)+'</b>'+(p.off?'<s>'+fmt(p.mrp)+'</s><em>'+p.off+'% off</em>':'')+'</div>'+
      '<div class="sact"><button class="padd" data-add type="button">Add to Cart</button><button class="sqv" data-open type="button" aria-label="Quick view">'+eye+'</button></div>'+
      '<div class="psizes"><span>Select size</span><div>'+SIZES.map(function(s){return '<button type="button" data-size="'+s+'">'+s+'</button>'}).join('')+'</div></div></div></article>'}).join('');
  }

  /* grid actions */
  $('#sgrid').addEventListener('click',function(e){
    if(e.target.closest('[data-clear]')){clearAll();return}
    var card=e.target.closest('.scard');if(!card)return;var id=+card.dataset.id;
    var sz=e.target.closest('[data-size]');
    if(sz){S.addToCart(id,sz.dataset.size,1,card.querySelector('.simg img'));card.classList.remove('picking');return}
    if(e.target.closest('[data-wish]')){S.toggleWish(id,e.target.closest('[data-wish]'));return}
    if(e.target.closest('[data-add]')){var was=card.classList.contains('picking');$$('.scard.picking').forEach(function(c){c.classList.remove('picking')});if(!was)card.classList.add('picking');return}
    if(e.target.closest('[data-open]')){S.setList(list);S.openPM(id)}
  });

  /* filters */
  function sync(){
    $$('.fcat').forEach(function(b){b.classList.toggle('on',b.dataset.c===f.cat)});
    $$('.sw').forEach(function(b){b.classList.toggle('on',b.dataset.col===f.col)});
    $$('.ot').forEach(function(b){b.classList.toggle('on',f.occ.indexOf(b.dataset.o)>-1)});
    $('#fDisc').checked=f.disc;$('#sSearch').value=f.q;$('#pMin').value=f.min;$('#pMax').value=f.max;
    $('#pMinL').textContent=fmt(f.min);$('#pMaxL').textContent=fmt(f.max);
  }
  function clearAll(){f.cat='All';f.q='';f.min=MIN;f.max=MAX;f.col=null;f.occ=[];f.disc=false;sync();render(true)}
  $('#fCats').addEventListener('click',function(e){var b=e.target.closest('.fcat');if(!b)return;f.cat=b.dataset.c;sync();render(true)});
  $('#fCols').addEventListener('click',function(e){var b=e.target.closest('.sw');if(!b)return;f.col=f.col===b.dataset.col?null:b.dataset.col;sync();render(true)});
  $('#fOcc').addEventListener('click',function(e){var b=e.target.closest('.ot');if(!b)return;var i=f.occ.indexOf(b.dataset.o);if(i>-1)f.occ.splice(i,1);else f.occ.push(b.dataset.o);sync();render(true)});
  $('#fDisc').addEventListener('change',function(){f.disc=this.checked;render(true)});
  var qT;$('#sSearch').addEventListener('input',function(){f.q=this.value.trim();clearTimeout(qT);qT=setTimeout(function(){render(true)},180)});
  function range(){
    var lo=+$('#pMin').value,hi=+$('#pMax').value;
    if(lo>hi-500){if(this===$('#pMin')){lo=hi-500;$('#pMin').value=lo}else{hi=lo+500;$('#pMax').value=hi}}
    f.min=lo;f.max=hi;$('#pMinL').textContent=fmt(lo);$('#pMaxL').textContent=fmt(hi);
  }
  ['#pMin','#pMax'].forEach(function(id){var el=$(id);el.addEventListener('input',range);el.addEventListener('change',function(){render(true)})});
  $('#fClear').onclick=clearAll;$('#sClearInline').onclick=clearAll;
  $('#sSort').addEventListener('change',function(){f.sort=this.value;render(true)});
  $('#vt').addEventListener('click',function(e){var b=e.target.closest('[data-v]');if(!b)return;f.view=b.dataset.v;$$('#vt button').forEach(function(x){x.classList.toggle('on',x===b)});render(true)});

  /* mobile filter drawer */
  function openF(){$('#filters').classList.add('open');$('#sscrim').classList.add('show')}
  function closeF(){$('#filters').classList.remove('open');$('#sscrim').classList.remove('show')}
  $('#fOpen').onclick=openF;$('#fClose').onclick=closeF;$('#sscrim').onclick=closeF;
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeF()});
  document.addEventListener('click',function(e){if(e.target.closest('[data-view]'))closeF()});

  var mq=$('#about .marquee');if(mq)$('#shopMarquee').innerHTML=mq.innerHTML;
  if(mq)$('#contactMarquee').innerHTML=mq.innerHTML;
  S.onRefresh=function(){derive();side();bounds();clearAll()};
  sync();render(false);
})();
