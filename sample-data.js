'use strict';
/* GERARAI — ข้อมูลตัวอย่าง (sample data)
 * ทุกเรคคอร์ดในไฟล์นี้มี is_sample:true — บุคคล ร้าน รีวิว พิกัด และตัวเลขเป็นข้อมูลสมมติ
 * เมื่อต่อ backend จริง: categories ย้ายเป็น enum/ตาราง, places/posts จะมาจากฐานข้อมูล
 * ไฟล์นี้ใช้เฉพาะโหมด local/demo และห้ามนำเข้าตาราง production โดยไม่ตั้ง is_sample = true
 */
(function(){
const imgs = {bangkok:'assets/bangkok.png',pharmacy:'assets/pharmacy.png',temple:'assets/chiang-mai.png',mountain:'assets/mountain-background.png'};
const categories = [
 {id:'all',name:'ทั้งหมด',emoji:'✨',color:'#3976d6'},
 {id:'food',name:'อาหาร',emoji:'🍜',color:'#f99c31'},
 {id:'cafe',name:'กาแฟ',emoji:'☕',color:'#a77d60'},
 {id:'health',name:'ยา/สุขภาพ',emoji:'✚',color:'#467bdd'},
 {is_sample:true,id:'stay',name:'ที่พัก',emoji:'🛏️',color:'#55a5ba'},
 {is_sample:true,id:'nature',name:'ธรรมชาติ',emoji:'🌲',color:'#59a175'},
 {id:'culture',name:'วัฒนธรรม',emoji:'🏯',color:'#b883d8'},
 {id:'travel',name:'เดินทาง',emoji:'🚆',color:'#e47d9b'}
];
const places = [
 {is_sample:true,id:'pharma',name:'PharmaPlus สาขานิมมาน',city:'เชียงใหม่',category:'health',image:imgs.pharmacy,coords:[18.7987,98.9672],rating:'4.6',reviews:312,description:'ร้านยาตัวอย่างในย่านนิมมาน บรรยากาศโปร่งสบาย ค้นพบเรื่องราวของผู้คนและสถานที่ใกล้เคียงในย่านนี้',address:'ย่านนิมมานเหมินท์ อำเภอเมืองเชียงใหม่',hours:'ข้อมูลเวลาทำการยังไม่เชื่อมต่อ'},
 {is_sample:true,id:'street',name:'ค่ำคืนที่เยาวราช',city:'กรุงเทพฯ',category:'food',image:imgs.bangkok,coords:[13.7397,100.5102],rating:'4.8',reviews:128,description:'เดินเล่นท่ามกลางแสงไฟและกลิ่นอาหารบนถนนเยาวราช แวะหามุมโปรด แล้วเก็บเรื่องราวเล็ก ๆ ระหว่างทาง',address:'ย่านเยาวราช กรุงเทพมหานคร',hours:'ช่วงเวลาที่แนะนำในต้นแบบ: ยามเย็น'},
 {is_sample:true,id:'temple',name:'เส้นทางวัดและขุนเขา',city:'เชียงใหม่',category:'culture',image:imgs.temple,coords:[18.805,98.921],rating:'4.9',reviews:86,description:'เส้นทางตัวอย่างสำหรับวันพักใจ ออกไปพบแสงเช้า สถาปัตยกรรมล้านนา และความสงบของภูเขา',address:'พื้นที่ตัวอย่างบนแผนที่ จังหวัดเชียงใหม่',hours:'ข้อมูลเวลาทำการยังไม่เชื่อมต่อ'},
 {is_sample:true,id:'coffee',name:'Slow Morning Café',city:'เชียงใหม่',category:'cafe',image:imgs.temple,coords:[18.789,98.977],rating:'4.7',reviews:64,description:'คาเฟ่สมมติสำหรับทดลองค้นหาสถานที่ นัดเจอกับเพื่อน และบันทึกมุมโปรดในเมือง',address:'พื้นที่ตัวอย่าง ย่านสวนดอก เชียงใหม่',hours:'ข้อมูลเวลาทำการยังไม่เชื่อมต่อ'},
 {is_sample:true,id:'nature',name:'เช้าวันใหม่ริมทะเลสาบ',city:'เชียงใหม่',category:'nature',image:imgs.mountain,coords:[18.86,98.955],rating:'4.8',reviews:42,description:'สถานที่และภาพประกอบสมมติสำหรับทดลองต้นแบบ ชวนออกไปใช้เวลาท่ามกลางธรรมชาติ',address:'พิกัดตัวอย่างสำหรับทดสอบแผนที่',hours:'ข้อมูลเวลาทำการยังไม่เชื่อมต่อ'},
 {is_sample:true,id:'stay',name:'The Little Journey Stay',city:'เชียงใหม่',category:'stay',image:imgs.temple,coords:[18.781,98.988],rating:'4.7',reviews:51,description:'ที่พักสมมติในต้นแบบ สำหรับทดลองค้นหาจุดพักระหว่างการเดินทาง',address:'พิกัดตัวอย่าง อำเภอเมืองเชียงใหม่',hours:'ข้อมูลการจองยังไม่เชื่อมต่อ'},
 {is_sample:true,id:'station',name:'เริ่มเดินทางที่หัวลำโพง',city:'กรุงเทพฯ',category:'travel',image:imgs.bangkok,coords:[13.7384,100.517],rating:'4.5',reviews:74,description:'จุดเริ่มต้นของเรื่องราวการเดินทางในต้นแบบ สำรวจย่านใกล้เคียงและบันทึกเส้นทางของคุณ',address:'ย่านหัวลำโพง กรุงเทพมหานคร',hours:'กรุณาตรวจตารางเดินทางกับผู้ให้บริการจริง'}
];
const seedPosts = [
 {is_sample:true,id:'mint',author:'Mint',avatar:'M',city:'กรุงเทพฯ',location:'Bangkok, Thailand',time:'2 ชม. ที่แล้ว',place:'street',image:imgs.bangkok,title:'วันนี้เจอร้านชาใต้ตำนาน อร่อยมากกก 🍵 ✨',body:'คนต่อคิวยาวตลอด แต่คุ้มค่ามาก… แค่ได้เดินเล่น หาของอร่อย แล้วเจอมุมใหม่ ๆ ก็เป็นวันที่ดีแล้ว',tags:['streetfood','Bangkok','ของอร่อย','ร้านที่เจอ'],likes:328,comments:12,following:false},
 {is_sample:true,id:'beam',author:'Beam',avatar:'B',city:'เชียงใหม่',location:'เชียงใหม่, Thailand',time:'3 วันที่แล้ว',place:'pharma',image:imgs.pharmacy,title:'อีกหนึ่งจุดแวะดี ๆ ในย่านนิมมาน 💙',body:'เดินสำรวจย่านเดิมด้วยมุมมองใหม่ วันนี้เก็บภาพหน้าร้านและบรรยากาศระหว่างทางมาฝาก',tags:['เชียงใหม่','นิมมาน','ระหว่างทาง'],likes:56,comments:4,following:true},
 {is_sample:true,id:'baitoey',author:'Baitoey',avatar:'B',city:'เชียงใหม่',location:'เชียงใหม่, Thailand',time:'เมื่อวาน',place:'temple',image:imgs.temple,title:'แสงเช้ากับภูเขา แค่นี้ก็พอแล้ว 🌤️',body:'บางทริปไม่ต้องมีแผนมากมาย แค่ออกไปเจออะไรใหม่ ๆ แล้วเก็บความทรงจำกลับมา',tags:['LifeExplorer','เชียงใหม่','วันพักใจ'],likes:142,comments:8,following:true,own:true}
];
window.GERARAI_SAMPLE=Object.freeze({imgs,categories,places,seedPosts});
})();
