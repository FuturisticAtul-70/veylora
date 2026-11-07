
/* ================= ADMIN PORTAL (single admin: mobile number + password) =================
   Order records are stored in Supabase; admin status and catalogue changes remain browser-local. */
(function(){
  var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
  var S=window.veyShop, A=window.veyAuth; if(!S||!A)return;
  var PHONE='8427314999', SALT='veyadmin-v1', HASH='e1f783eefcb14cdf0e56f1a32c4ac2897440fb903c260952e70711d2f9f2ba07';   /* the only admin: Aisha Mehra */
  var STAT=['Placed','Confirmed','Packed','Shipped','Out for delivery','Delivered','Cancelled'];
  var SCLS={'Placed':'Placed','Confirmed':'Confirmed','Packed':'Packed','Shipped':'Shipped','Out for delivery':'Out','Delivered':'Delivered','Cancelled':'Cancelled'};
  var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var CATS=['Lehenga','Indo-Western','Sharara & Palazzo','Kurta & Anarkali'];
  var TONES={'Black':'#1f1a1c','Green':'#6f9a74','Blue':'#7db3dc','Red & Wine':'#9b2d44'};
  var OCCS=['Wedding','Festive','Sangeet & Mehendi','Cocktail & Party','Engagement'];
  var fmt=S.fmt;
  var esc=function(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var clean=function(t){return String(t||'').replace(/[<>"`]/g,'').replace(/\s+/g,' ').trim()};
  var toastT;function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show')},2600)}

  /* ---------- session (cleared when the tab closes) ---------- */
  var mem=false;
  function isIn(){try{return sessionStorage.getItem('vey_admin')==='1'}catch(e){return mem}}
  function setIn(v){mem=v;try{v?sessionStorage.setItem('vey_admin','1'):sessionStorage.removeItem('vey_admin')}catch(e){}}

  /* ---------- login ---------- */
  var lg=$('#admLogin'),fails=0,lockUntil=0;
  function openLogin(){
    if(isIn()){openPanel();return}
    lg.classList.add('show');lg.setAttribute('aria-hidden','false');$('#admErr').textContent='';
    setTimeout(function(){$('#admPhone').focus()},350);
  }
  function closeLogin(){lg.classList.remove('show');lg.setAttribute('aria-hidden','true')}
  $('#admLClose').onclick=closeLogin;
  lg.addEventListener('mousedown',function(e){if(e.target===lg)closeLogin()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeLogin()});
  function lfail(msg,el){
    var e=$('#admErr');e.textContent=msg;e.classList.remove('shake');void e.offsetWidth;e.classList.add('shake');
    if(el)el.classList.add('bad');return false;
  }
  $('#admPhone').addEventListener('input',function(){this.classList.remove('bad')});
  $('#admPass').addEventListener('input',function(){this.classList.remove('bad')});
  var lastTry=0;
  function doLogin(){
    var now=Date.now();if(now-lastTry<120)return;lastTry=now;
    try{
      var phEl=$('#admPhone'),pwEl=$('#admPass'),pw=pwEl.value.trim();
      if(now<lockUntil)return lfail('Too many attempts. Try again in '+Math.ceil((lockUntil-now)/1000)+' seconds.');
      var ph=phEl.value.replace(/\D/g,'');
      if(ph.length===12&&ph.indexOf('91')===0)ph=ph.slice(2);
      if(ph.length===11&&ph.charAt(0)==='0')ph=ph.slice(1);
      if(!/^\d{10}$/.test(ph))return lfail('Please enter the 10-digit admin mobile number.',phEl);
      if(!pw)return lfail('Please enter the password.',pwEl);
      if(ph!==PHONE||A.sha(SALT+':'+ph+':'+pw)!==HASH){
        fails++;
        if(fails>=5){fails=0;lockUntil=now+60000;return lfail('Too many attempts. Locked for 60 seconds.')}
        return lfail('Incorrect mobile number or password.',pwEl);
      }
      fails=0;setIn(true);$('#admErr').textContent='';$('#admLForm').reset();closeLogin();openPanel();toast('Welcome, Aisha');
    }catch(err){lfail('Something went wrong ('+(err&&err.message||err)+'). Please reload the page and try again.')}
  }
  $('#admLForm').addEventListener('submit',function(e){e.preventDefault();doLogin()});
  $('#admLForm button[type=submit]').addEventListener('click',function(e){e.preventDefault();doLogin()});
  /* entry points: small link in the customer login box, or the #admin address */
  document.addEventListener('click',function(e){
    if(e.target.id==='goAdmin'){e.preventDefault();var x=$('#authClose');if(x)x.click();openLogin()}
  });
  function fromHash(){if(location.hash==='#admin'){openLogin();try{history.replaceState(null,'',location.pathname+location.search)}catch(_){}}}
  window.addEventListener('hashchange',fromHash);fromHash();

  /* ---------- panel shell ---------- */
  var panel=$('#adm'),fab=$('#admFab'),tab='dash',range='daily',oStat='All',oQ='';
  function paintFab(){fab.hidden=!(isIn()&&panel.hidden)}
  function openPanel(){
    A.reload();panel.hidden=false;panel.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
    paintFab();draw();panel.scrollTop=0;
  }
  function closePanel(){panel.hidden=true;panel.setAttribute('aria-hidden','true');document.body.style.overflow='';paintFab()}
  fab.onclick=openPanel;
  $('#admView').onclick=closePanel;
  $('#admOut').onclick=function(){setIn(false);closePanel();toast('Admin logged out')};
  $('#admRefresh').onclick=function(){A.reload();draw();toast('Refreshed')};
  $('#admTabs').addEventListener('click',function(e){var b=e.target.closest('[data-t]');if(!b)return;tab=b.dataset.t;draw();panel.scrollTop=0});
  paintFab();

  /* ---------- order data ---------- */
  function allOrders(){
    var U=A.users()||{},out=[];
    Object.keys(U).forEach(function(em){var u=U[em];(u.orders||[]).forEach(function(o){out.push({o:o,em:em,u:u})})});
    out.sort(function(a,b){return b.o.date-a.o.date});return out;
  }
  var stOf=function(o){return STAT.indexOf(o.status)>-1?o.status:'Placed'};
  var badge=function(s){return '<span class="st st-'+SCLS[s]+'">'+s+'</span>'};
  function dt(t){var d=new Date(t);return d.getDate()+' '+MON[d.getMonth()]+' '+d.getFullYear()+', '+d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})}
  function dayStart(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate())}
  function addDays(d,n){return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)}
  function weekStart(d){var s=dayStart(d);return addDays(s,-((s.getDay()+6)%7))}
  function monthAt(d,n){return new Date(d.getFullYear(),d.getMonth()+n,1)}
  function agg(L,s,e){var n=0,r=0;L.forEach(function(x){var t=x.o.date;if(t>=s&&t<e&&stOf(x.o)!=='Cancelled'){n++;r+=(+x.o.total||0)}});return{n:n,r:r}}
  function buckets(kind){
    var now=new Date(),b=[],i,s,e;
    if(kind==='daily')for(i=13;i>=0;i--){s=addDays(dayStart(now),-i);e=addDays(s,1);b.push({s:s,e:e,l:s.getDate()+' '+MON[s.getMonth()],n:i===0?'Today':s.toDateString().slice(0,3)+', '+s.getDate()+' '+MON[s.getMonth()]})}
    if(kind==='weekly')for(i=7;i>=0;i--){s=addDays(weekStart(now),-7*i);e=addDays(s,7);var l=addDays(s,6);b.push({s:s,e:e,l:s.getDate()+' '+MON[s.getMonth()],n:(i===0?'This week · ':'')+s.getDate()+' '+MON[s.getMonth()]+' – '+l.getDate()+' '+MON[l.getMonth()]})}
    if(kind==='monthly')for(i=5;i>=0;i--){s=monthAt(now,-i);e=monthAt(now,-i+1);b.push({s:s,e:e,l:MON[s.getMonth()]+" '"+String(s.getFullYear()).slice(2),n:MON[s.getMonth()]+' '+s.getFullYear()+(i===0?' (this month)':'')})}
    return b;
  }

  /* ---------- views ---------- */
  var main=$('#admMain');
  function draw(){
    $$('#admTabs button').forEach(function(b){b.classList.toggle('on',b.dataset.t===tab)});
    var L=allOrders(),fresh=L.filter(function(x){return stOf(x.o)==='Placed'}).length;
    $('#admNew').textContent=fresh?fresh:'';
    if(tab==='dash')main.innerHTML=dashHTML(L);
    else if(tab==='orders')main.innerHTML=ordersHTML(L);
    else main.innerHTML=prodsHTML();
  }
  var NOTE='<p class="adm-note">Order records are saved in Supabase. Delivery-status changes and catalogue changes remain saved in this browser.</p>';

  function dashHTML(L){
    var now=new Date(),t0=dayStart(now),w0=weekStart(now),m0=monthAt(now,0);
    var d=agg(L,t0,addDays(t0,1)),w=agg(L,w0,addDays(w0,7)),m=agg(L,m0,monthAt(now,1));
    var open=L.filter(function(x){var s=stOf(x.o);return s!=='Delivered'&&s!=='Cancelled'}).length;
    var card=function(k,v,sub){return '<div class="adm-card"><small>'+k+'</small><b>'+v+'</b><span>'+sub+'</span></div>'};
    var h=NOTE+'<div class="adm-cards">'+
      card('Today',d.n,d.n===1?'order · '+fmt(d.r):'orders · '+fmt(d.r))+
      card('This week',w.n,(w.n===1?'order · ':'orders · ')+fmt(w.r))+
      card('This month',m.n,(m.n===1?'order · ':'orders · ')+fmt(m.r))+
      card('To deliver',open,'orders in progress')+'</div>';
    var B=buckets(range).map(function(b){var a=agg(L,b.s,b.e);a.l=b.l;a.n2=b.n;return a});
    var max=Math.max.apply(null,B.map(function(x){return x.n}).concat([1]));
    h+='<div class="adm-panel"><div class="adm-ph"><h3>Orders over time</h3><div class="seg" id="admRange">'+
      [['daily','Daily'],['weekly','Weekly'],['monthly','Monthly']].map(function(r){return '<button type="button" data-r="'+r[0]+'"'+(range===r[0]?' class="on"':'')+'>'+r[1]+'</button>'}).join('')+'</div></div>';
    if(!L.length)h+='<div class="adm-empty"><b>No orders yet</b>When a customer checks out, the order shows up here with its daily, weekly and monthly totals.</div>';
    h+='<div class="chart-wrap"><div class="chart">'+B.map(function(x){return '<div class="bar" title="'+esc(x.n2)+': '+x.n+' orders, '+fmt(x.r)+'"><em>'+(x.n||'')+'</em><i class="'+(x.n?'':'z')+'" style="height:'+(x.n?Math.max(4,Math.round(x.n/max*150)):3)+'px"></i></div>'}).join('')+'</div>'+
      '<div class="xl">'+B.map(function(x){return '<span>'+x.l+'</span>'}).join('')+'</div></div>'+
      '<table class="adm-tbl"><thead><tr><th>Period</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>'+
      B.slice().reverse().map(function(x,i){return '<tr'+(i===0?' class="cur"':'')+'><td>'+esc(x.n2)+'</td><td>'+x.n+'</td><td>'+fmt(x.r)+'</td></tr>'}).join('')+'</tbody></table>'+
      '<p class="hint2" style="margin-top:10px">Cancelled orders are not counted.</p></div>';
    var cnt={};STAT.forEach(function(s){cnt[s]=0});L.forEach(function(x){cnt[stOf(x.o)]++});
    h+='<div class="adm-panel"><h3>Delivery status</h3><div class="stat-chips">'+STAT.map(function(s){return '<button type="button" class="st-'+SCLS[s]+'" data-go="'+s+'"><b>'+cnt[s]+'</b><span>'+s+'</span></button>'}).join('')+'</div></div>';
    return h;
  }

  function payHTML(o){
    var p=o.pay;if(!p)return '';
    var upi=p.method==='UPI',paid=/^Paid/.test(p.status);
    var h='<div class="o-pay"><span class="pay-chip '+(paid?'ok':'wait')+'">'+(upi?'UPI':'Cash on Delivery')+' &middot; '+esc(p.status)+'</span>';
    if(upi&&p.utr)h+='<span class="pay-utr">UTR <b>'+esc(p.utr)+'</b></span>';
    if(upi&&!paid)h+='<button type="button" data-paid>Mark payment received</button>';
    if(upi&&paid)h+='<button type="button" data-unpaid>Undo</button>';
    return h+'</div>';
  }
  function ordersHTML(L){
    var q=oQ.toLowerCase();
    var F=L.filter(function(x){
      if(oStat!=='All'&&stOf(x.o)!==oStat)return false;
      if(!q)return true;
      var a=x.o.address||{};
      return (x.o.id+' '+(a.name||'')+' '+(a.phone||'')+' '+x.em+' '+(x.u.name||'')).toLowerCase().indexOf(q)>-1;
    });
    var h=NOTE+'<div class="o-bar"><input id="oQ" type="search" placeholder="Search order ID, name, phone or email" value="'+esc(oQ)+'">'+
      '<select id="oS"><option>All</option>'+STAT.map(function(s){return '<option'+(s===oStat?' selected':'')+'>'+s+'</option>'}).join('')+'</select>'+
      '<span class="o-cnt">'+F.length+(F.length===1?' order':' orders')+'</span></div>';
    if(!F.length)return h+'<div class="adm-panel adm-empty"><b>'+(L.length?'No orders match':'No orders yet')+'</b>'+(L.length?'Try another status or search.':'Orders placed on the website will appear here.')+'</div>';
    return h+F.map(function(x){
      var o=x.o,a=o.address||{},s=stOf(o);
      var items=(o.items||[]).map(function(i){return esc(i.name)+' <span style="color:#9b6a72">('+esc(i.type||'Product')+' · Size '+esc(i.size)+') &times; '+i.qty+'</span>'}).join('<br>');
      var msg='Hi '+(a.name||'there')+', your Veylora order '+o.id+' is now: '+s+'.';
      var hist=(o.history&&o.history.length?o.history:[{s:'Placed',t:o.date}]).map(function(h){return '<li>'+esc(h.s)+' &middot; '+dt(h.t)+'</li>'}).join('');
      var delivery=[a.line,a.city,a.state].filter(Boolean).join(', ')+(a.pin?' - '+a.pin:'');
      if(!delivery)delivery='Shipping address is saved in the customer Supabase account.';
      return '<article class="o-card" data-o="'+esc(o.id)+'" data-e="'+esc(x.em)+'"><div class="o-head"><b>'+esc(o.id)+'</b><span class="o-date">'+dt(o.date)+'</span>'+badge(s)+'</div>'+
        '<div class="o-body"><div><small>Customer</small><strong>'+esc(a.name||x.u.name)+'</strong><br>'+esc(a.phone||'')+'<br>'+esc(x.em)+'</div>'+
        '<div><small>Items</small>'+items+'</div>'+
        '<div><small>Deliver to</small>'+esc(delivery)+(a.landmark?'<br>Near '+esc(a.landmark):'')+'</div>'+
        '<div class="o-total"><small>Total</small><b>'+fmt(o.total)+'</b></div></div>'+
        '<div class="o-foot">'+payHTML(o)+'<label>Delivery status<select data-st>'+STAT.map(function(t){return '<option'+(t===s?' selected':'')+'>'+t+'</option>'}).join('')+'</select></label>'+
        (a.phone?'<a target="_blank" rel="noopener" href="https://wa.me/91'+esc(a.phone)+'?text='+encodeURIComponent(msg)+'">Message customer on WhatsApp</a>':'')+'</div>'+
        '<details class="o-hist"><summary>Status history</summary><ul>'+hist+'</ul></details></article>';
    }).join('');
  }

  function prodsHTML(){
    var P=S.P,rm=S.cat.removed(),used=S.cat.bytes();
    var h='<div class="adm-panel"><h3>Add an item</h3><p class="hint2" style="margin:4px 0 16px">It appears on the Collections and Shop pages straight away.</p>'+
      '<form class="pf" id="pForm" novalidate>'+
      '<label class="full">Item name<input id="pName" type="text" maxlength="70" placeholder="e.g. Rose Gold Zari Lehenga"></label>'+
      '<label>Category<select id="pCat">'+CATS.map(function(c){return '<option>'+esc(c)+'</option>'}).join('')+'</select></label>'+
      '<label>Colour family<select id="pTone">'+Object.keys(TONES).map(function(c){return '<option>'+esc(c)+'</option>'}).join('')+'</select></label>'+
      '<label>Selling price (&#8377;)<input id="pPrice" type="number" inputmode="numeric" min="1" step="1" placeholder="e.g. 5599"></label>'+
      '<label>Original price / MRP (&#8377;, optional)<input id="pMrp" type="number" inputmode="numeric" min="1" step="1" placeholder="Shows a discount if higher"></label>'+
      '<div class="full"><span class="lab">Photo</span><div class="up"><img id="pPrev" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="><div class="up-r"><label class="choose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg><span id="pChoose">Choose photo from device</span><input id="pImg" type="file" accept="image/*"></label><input id="pUrl" type="url" inputmode="url" placeholder="Or paste an image link (https://...)" style="width:100%"><span class="hint2" id="pFile">JPG or PNG. On a phone you can pick from your gallery or take a new photo.</span></div></div></div>'+
      '<div class="full"><label>Occasion (optional)</label><div class="occs" id="pOcc">'+OCCS.map(function(o){return '<label><input type="checkbox" value="'+esc(o)+'">'+esc(o)+'</label>'}).join('')+'</div></div>'+
      '<label>Fabric (optional)<input id="pFab" type="text" maxlength="80" placeholder="e.g. Raw silk with zari work"></label>'+
      '<label>Includes (optional)<input id="pInc" type="text" maxlength="80" placeholder="e.g. Blouse, lehenga, dupatta"></label>'+
      '<label class="full">Description (optional)<textarea id="pDesc" maxlength="300" placeholder="A line or two about the outfit"></textarea></label>'+
      '<p class="err full" id="pErr" role="alert"></p>'+
      '<div class="pf-act full"><button class="btn-primary" id="pAdd" type="submit">Add to website</button><span class="hint2">Photo storage used: '+(used/1048576).toFixed(1)+' MB of about 5 MB</span></div></form></div>'+
      '<div class="adm-panel"><div class="adm-ph"><h3>Items on the website ('+P.length+')</h3>'+(rm?'<button type="button" class="ghost" id="pRestore">Restore '+rm+' removed original '+(rm===1?'item':'items')+'</button>':'')+'</div>'+
      (P.length?'<div class="apg">'+P.map(function(p){return '<div class="apc" data-id="'+p.id+'"><img src="'+p.img+'" alt=""><div><small>'+esc(p.cat)+'</small><h5>'+esc(p.name)+'</h5><p>'+fmt(p.price)+(p.off?'<s>'+fmt(p.mrp)+'</s>':'')+'</p><button type="button" data-rm>Remove</button></div></div>'}).join('')+'</div>':'<div class="adm-empty"><b>The shop is empty</b>Add your first item above.</div>')+'</div>';
    return h;
  }

  /* ---------- clicks inside the panel ---------- */
  main.addEventListener('click',function(e){
    var pb=e.target.closest('[data-paid],[data-unpaid]');
    if(pb){
      var pc=pb.closest('.o-card'),PU=A.users(),pu=PU[pc.dataset.e];
      var po=pu&&(pu.orders||[]).filter(function(x){return x.id===pc.dataset.o})[0];
      if(po&&po.pay){var yes=pb.hasAttribute('data-paid');po.pay.status=yes?'Paid':'Awaiting verification';A.save();draw();toast(yes?'Payment marked as received':'Payment marked as awaiting verification')}
      return;
    }
    var r=e.target.closest('[data-r]');if(r){range=r.dataset.r;draw();return}
    var g=e.target.closest('[data-go]');if(g){oStat=g.dataset.go;oQ='';tab='orders';draw();panel.scrollTop=0;return}
    if(e.target.id==='pRestore'){S.cat.restore();S.refresh();draw();toast('Original items restored');return}
    var b=e.target.closest('[data-rm]');
    if(b){
      if(!b.classList.contains('arm')){b.classList.add('arm');b.textContent='Tap again to remove';setTimeout(function(){if(b.isConnected){b.classList.remove('arm');b.textContent='Remove'}},3500);return}
      var id=+b.closest('.apc').dataset.id;S.cat.remove(id);S.refresh();draw();toast('Item removed from the website');
    }
  });
  main.addEventListener('input',function(e){if(e.target.id==='pImg'&&e.target.files&&e.target.files[0]&&!imgData)showPrev(e.target.files[0])});
  main.addEventListener('change',function(e){
    if(e.target.id==='oS'){oStat=e.target.value;draw();return}
    if(e.target.id==='pImg'){showPrev(e.target.files&&e.target.files[0]);return}
    var sel=e.target.closest('[data-st]');
    if(sel){
      var card=sel.closest('.o-card'),U=A.users(),u=U[card.dataset.e];if(!u)return;
      var o=(u.orders||[]).filter(function(x){return x.id===card.dataset.o})[0];if(!o)return;
      o.status=sel.value;o.history=o.history||[{s:'Placed',t:o.date}];o.history.push({s:sel.value,t:Date.now()});
      if(sel.value==='Delivered'&&o.pay&&o.pay.method==='COD')o.pay.status='Paid';
      A.save();draw();toast('Order '+o.id+' marked '+sel.value);
    }
  });
  var qT;main.addEventListener('input',function(e){
    if(e.target.id!=='oQ')return;oQ=e.target.value;clearTimeout(qT);
    qT=setTimeout(function(){var pos=e.target.selectionStart;draw();var n=$('#oQ');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}},200);
  });

  /* ---------- add item ---------- */
  var imgData=null;
  function showPrev(f){
    imgData=null;var pv=$('#pPrev');if(!f)return;
    readImage(f).then(function(d){imgData=d;pv.src=d;$('#pFile').textContent=f.name+' \u00b7 ready to upload';$('#pChoose').textContent='Change photo'},function(m){imgData=null;$('#pImg').value='';$('#pChoose').textContent='Choose photo from device';perr(m,$('.choose'))});
  }
  function readImage(f){
    return new Promise(function(res,rej){
      if(!/^image\//.test(f.type))return rej('Please choose a JPG or PNG photo.');
      if(f.size>20*1048576)return rej('That photo is too large. Please use one under 20 MB.');
      var fr=new FileReader();
      fr.onerror=function(){rej('Could not read that photo.')};
      fr.onload=function(){
        var im=new Image();
        im.onerror=function(){rej('Could not open that photo. Please use a JPG or PNG.')};
        im.onload=function(){
          var m=1100,k=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');
          c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);
          var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
          res(c.toDataURL('image/jpeg',.82));
        };
        im.src=fr.result;
      };
      fr.readAsDataURL(f);
    });
  }
  function perr(msg,el){
    var e=$('#pErr');if(!e)return false;e.textContent=msg;e.classList.remove('shake');void e.offsetWidth;e.classList.add('shake');
    $$('#pForm .bad').forEach(function(x){x.classList.remove('bad')});
    if(el){el.classList.add('bad');try{el.focus({preventScroll:false})}catch(_){}}
    try{e.scrollIntoView({block:'center',behavior:'smooth'})}catch(_){}
    return false;
  }
  main.addEventListener('click',function(e){
    if(!e.target.closest('#pAdd'))return;e.preventDefault();
    var f=$('#pForm');f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
  });
  main.addEventListener('submit',function(e){
    if(e.target.id!=='pForm')return;e.preventDefault();
    var name=clean($('#pName').value),price=Math.round(+$('#pPrice').value),mrpRaw=$('#pMrp').value.trim(),mrp=mrpRaw?Math.round(+mrpRaw):price;
    if(name.length<3)return perr('Please enter the item name.',$('#pName'));
    if(!(price>=1&&price<=1000000))return perr('Please enter a selling price in rupees.',$('#pPrice'));
    if(mrpRaw&&!(mrp>=price))return perr('The original price must be the same as or higher than the selling price.',$('#pMrp'));
    var pu=$('#pUrl').value.trim();
    if(!imgData&&pu){if(!/^https?:\/\/[^\s"'<>]+$/i.test(pu))return perr('That image link does not look right. It should start with https://',$('#pUrl'));imgData=pu}
    if(!imgData)return perr('Please choose a photo from your device (or paste an image link).',$('.choose'));
    var occ=$$('#pOcc input:checked').map(function(i){return i.value});
    var tone=$('#pTone').value,btn=$('#pAdd');btn.disabled=true;
    var ok=S.cat.add({img:imgData,pos:'50% 20%',name:name,cat:$('#pCat').value,mrp:mrp,price:price,color:tone,tone:tone,hex:TONES[tone],
      fabric:clean($('#pFab').value)||'—',includes:clean($('#pInc').value)||'—',occasion:occ.join(', ')||'Festive',
      desc:clean($('#pDesc').value)||'A new look from the Veylora collection.'});
    btn.disabled=false;
    if(!ok)return perr('This browser has no storage space left for another photo. Remove an item you no longer sell, then try again.');
    imgData=null;S.refresh();draw();toast('“'+name+'” is now on the website');
  });
})();
