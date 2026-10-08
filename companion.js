/* Concept sprites only: 24px grid, integer geometry, separate body/detail/accessory groups. */
(() => {
const palettes={cream:['#dcc69f','#a48664','#f8edd5'],brown:['#b9895c','#7e6048','#e5c69e'],gray:['#8d9a9a','#596b70','#d5dbd2'],orange:['#c89561','#936540','#f0d7ac'],black:['#465151','#28383f','#95a29b'],white:['#c9d0c5','#83958a','#fff9e9'],pied:['#e6d6b9','#6b6258','#fff3dc']};
const rect=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
function sprite(kind,color='cream',accessory=false){const [base,dark,light]=palettes[color]||palettes.cream,ink='#28383f',pink='#ba8d79';let body='',details='',extra='';
if(kind==='dog'){
 body=rect(8,13,11,7,base)+rect(7,18,4,4,base)+rect(16,18,4,4,base)+rect(6,6,12,10,base)+rect(4,7,4,8,dark)+rect(16,7,4,8,dark)+rect(19,13,3,3,base)+rect(21,9,2,5,base);
 details=rect(8,11,8,5,light)+rect(8,9,2,2,ink)+rect(14,9,2,2,ink)+rect(11,12,3,2,ink)+rect(8,21,3,1,dark)+rect(17,21,3,1,dark);
 if(accessory)extra=rect(8,16,10,2,'#587666')+rect(14,18,3,2,'#587666');
}else if(kind==='cat'){
 body=rect(6,6,12,10,base)+rect(6,3,3,5,base)+rect(7,4,3,3,base)+rect(15,3,3,5,base)+rect(14,5,3,2,base)+rect(8,14,9,7,base)+rect(7,20,12,2,base)+rect(17,17,5,3,base)+rect(20,11,3,8,base)+rect(19,10,3,2,base);
 details=rect(7,6,2,2,pink)+rect(15,6,2,2,pink)+rect(8,10,2,2,ink)+rect(14,10,2,2,ink)+rect(11,13,2,1,pink)+rect(10,16,4,5,light)+rect(11,7,2,2,dark)+rect(5,14,3,1,dark)+rect(17,14,2,1,dark);
 if(accessory)extra=rect(8,15,9,1,'#526f75')+rect(12,16,2,2,'#cda65f');
}else if(kind==='bird'){
 body=rect(8,6,8,3,base)+rect(6,9,11,9,base)+rect(8,17,8,3,base)+rect(16,14,5,3,dark)+rect(18,12,3,3,dark);
 details=rect(4,10,4,2,'#bc8c51')+rect(9,9,2,2,ink)+rect(10,12,5,5,dark)+rect(7,13,2,4,light)+rect(9,20,1,2,dark)+rect(14,20,1,2,dark)+rect(8,21,3,1,dark)+rect(13,21,3,1,dark);
}else if(kind==='rabbit'){
 body=rect(6,1,4,11,base)+rect(14,0,4,12,base)+rect(5,10,14,8,base)+rect(7,17,12,4,base)+rect(5,20,6,2,base)+rect(15,20,6,2,base)+rect(19,16,3,3,light);
 details=rect(7,3,2,7,pink)+rect(15,2,2,8,pink)+rect(8,13,2,2,ink)+rect(14,13,2,2,ink)+rect(11,16,2,1,pink)+rect(10,18,5,3,light)+rect(6,21,4,1,dark)+rect(16,21,4,1,dark);
 if(accessory)extra=rect(7,18,11,1,'#587666')+rect(15,19,2,2,'#587666');
}else{
 body=rect(5,7,4,4,base)+rect(15,7,4,4,base)+rect(6,9,12,3,base)+rect(4,12,16,7,base)+rect(6,18,12,3,base)+rect(7,20,3,2,base)+rect(15,20,3,2,base);
 details=rect(6,8,2,2,pink)+rect(16,8,2,2,pink)+rect(5,15,5,4,light)+rect(14,15,5,4,light)+rect(8,12,2,2,ink)+rect(14,12,2,2,ink)+rect(11,15,2,1,pink)+rect(10,17,4,4,light)+rect(7,21,3,1,dark)+rect(15,21,3,1,dark);
}
return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" shape-rendering="crispEdges" role="img" aria-label="${kind} companion"><g id="body">${body}</g><g id="details">${details}</g><g id="accessory">${extra}</g></svg>`;
}
window.GerdeyPetConcept={sprite,palettes};
})();
