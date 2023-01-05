const express = require('express');
const app = express(); // express를 이용한 서버구동

const http = require('http').createServer(app); // socket.io 세팅
const { Server } = require("socket.io");
const io = new Server(http);

const bodyParser = require('body-parser'); // req.body 사용 가능
app.use(bodyParser.urlencoded({extended : true}));

app.set('view engine', 'ejs');

app.use('/public', express.static('public')); 

const methodOverrride = require('method-override')
app.use(methodOverrride('_method'))

require('dotenv').config()

const { ObjectId, ChangeStream } = require('mongodb');

var db; // db 전역변수로 하기 위함
const MongoClient = require('mongodb').MongoClient;
MongoClient.connect(process.env.DB_URL, function(err, client){
    // database 접속이 완료되면 실행되는 콜백함수
    if(err) return console.log(err)
    
    db = client.db('todoapp'); // db변수에 todoapp이라는 database 연결
    
    http.listen(process.env.PORT, function(){
        console.log('listening on 8080')
    });
})




app.get('/socket', (요청, 응답) => {
    응답.render('socket.ejs')
})

io.on('connection', function(socket){ // 웹소켓에 접속하면 내부코드 실행
    console.log('유저접속됨');

    socket.on('room1-send', function(data){ // (socket.emit을 수신. 이벤트 리스너) usersend이벤트 발생하면 내부코드 실행. data에는 socket.emit으로 보낸게 들어가있음
        io.to('room1').emit('broadcast', data); // 현 유저 room1 입장 요청
    });
    
    socket.on('joinroom', function(data){ // (socket.emit을 수신. 이벤트 리스너) usersend이벤트 발생하면 내부코드 실행. data에는 socket.emit으로 보낸게 들어가있음
        socket.join('room1'); // 현 유저 채팅방 입장 요청
    });

    socket.on('user-send', function(data){ // (socket.emit을 수신. 이벤트 리스너) usersend이벤트 발생하면 내부코드 실행. data에는 socket.emit으로 보낸게 들어가있음
        io.emit('broadcast', data); // 서버가 모든유저에게
        // io.to(socket.id).emit('broadcast', data) // 접속한 유저에게
    });



})




app.get('/', function(req, res){ // /하나만 쓰면 홈
    res.render('index.ejs');
});

app.get('/write', function(req, res){
    res.render('write.ejs');
})



app.get('/list', function(req, res){
    db.collection('post').find().toArray(function(err, result){ // result에 가져온 데이터가 저장 되어있음
        console.log(result);
        res.render('list.ejs', { posts : result }); // result 라는 데이터를 posts 라는 이름으로 ejs 파일에 보내기
    });
});

app.get('/search', (req, res) => { // request.query로 쿼리스트링 가져옴
    var 검색조건 = [
        {
            $search: {
              index: 'titleSearch',
              text: {
                query: req.query.value,
                path: '제목'  // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
              }
            }
        },
        //{ $sort : { _id : -1 } }, // 검색 조건 더 주기
        //{ $project : { 제목 : 1, _id : 0, score : { $meta : "searchScore" } } }
    ]
    db.collection('post').aggregate(검색조건).toArray((err, result) => {
        console.log(result)
        res.render('search.ejs', { searches : result });
    })
});



app.get('/detail/:id', function(request, response){ // url의 파라미터 중 id가 결과에 담김
    db.collection('post').findOne({_id : parseInt(request.params.id)}, function(에러, 결과){
        console.log(결과)
        response.render('detail.ejs', { data : 결과 })
        // detail.ejs를 렌더링 하면서 결과를 data라는 이름으로 보냄
    })
})

app.get('/edit/:id', function(request, response){
    db.collection('post').findOne({_id : parseInt(request.params.id)}, function(에러, 결과){
        console.log(결과)
        response.render('edit.ejs', { post : 결과 });
    })
})

app.put('/edit', function(request, response){
    db.collection('post').updateOne({ _id : parseInt(request.body.id) }, { $set : { 제목 : request.body.title, 날짜 : request.body.date } }, 
        function(에러, 결과){
            console.log('수정완료')
            response.redirect('/list')
        })
})


const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const { request } = require('express');

app.use(session({secret : '비밀코드', resave : true, saveUninitialized : false}));
app.use(passport.initialize());
app.use(passport.session());
// app.use(미들웨어) 요청-응답 중간에 실행되는 코드

app.get('/login', function(request, response){
    response.render('login.ejs')
})

app.post('/login', passport.authenticate('local', { // local 방식으로 회원 인증. 미들웨어
    failuareRedirect : '/fail' // 실패 시 /fail로 이동
}), function(request, response){
    response.redirect('/')
});

app.get('/mypage', islogin, function(request, response){
    console.log(request.user)// request.user 하면 deserialize한 유저 db정보 다 담겨있음
    response.render('mypage.ejs', {사용자 : request.user})
});

function islogin(request, response, next){
    if(request.user){ // request.user는 로그인 한 상태이면 항상 있음
        next() // 통과
    } else {
        response.send('로그인 안하심')
    }
}


// localstrategy 인증방식
passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw', // 유저가 입력한 아이디 비번 항목이 뭔지 정의(name 속성)
    session: true,
    passReqToCallback: false,
  }, function (입력한아이디, 입력한비번, done) { // 사용자의 아이디 비번 검증 부분
    //console.log(입력한아이디, 입력한비번);
    db.collection('login').findOne({ id: 입력한아이디 }, function (에러, 결과) {
      if (에러) return done(에러)
      
      if (!결과) return done(null, false, { message: '존재하지 않는 아이디요' })
      if (입력한비번 == 결과.pw) { // db에 아이디가 있으면, 입력한 비번과 결과.pw를 비교
        return done(null, 결과) // 다 맞았을 때. 두번째 파라미터로 전송 
      } else {
        return done(null, false, { message: '비번틀렸어요' })
      }
    })
}));

passport.serializeUser(function(user, done){ // 세션을 저장시키는 코드(로그인 성공 시)
    done(null, user.id)
});
// user.id는 아이디와 같음
passport.deserializeUser(function(아이디, done){ // 이 세션 데이터를 가진 사람을 db에서 찾기 (마이페이지 접속 시)
    db.collection('login').findOne({id : 아이디}, function(에러, 결과){
        done(null, 결과) // 결과는 찾은 유저 db
    })
});

app.post('/register', (request, response) => {
    db.collection('login').insertOne( { id : request.body.id , pw : request.body.pw }, (에러, 결과) => {
        response.redirect('/')
    })
})

app.post('/add', function(req, res){ // req.body에 form으로 전송된 정보가 저장되어있음\

    res.send('전송완료')
    db.collection('counter').findOne({ name : '게시물갯수' }, function(err, result){
        console.log(result.totalPost);
        var 총게시물갯수 = result.totalPost;

        var 저장할거 = { _id : 총게시물갯수 + 1, 작성자 : req.user._id, 날짜 : req.body.date, 제목 : req.body.title  }

        // db(todoapp database)의 post라는 collection에 데이터 삽입
        db.collection('post').insertOne(저장할거 , function(에러, 결과){
            console.log('저장완료');
            // counter라는 컬렉션에 있는 totalPost라는 항목도 1 증가시켜야함. {}를 {operator : {}}
            db.collection('counter').updateOne( { name : '게시물갯수' }, { $inc : { totalPost : 1 } }, function(err, result){
                if(err) return console.log(err);
            });
        });
    });
});

app.delete('/delete', function(request, response){ // ajax 요청
    console.log(request.body)
    request.body._id = parseInt(request.body._id);

    var 삭제할데이터 = { _id : request.body._id, 작성자 : request.user._id }
    
    db.collection('post').deleteOne(삭제할데이터, function(err, result){
        console.log('삭제완료');
        if(err) {console.log(err)}
        response.status(200).send({ message : '성공했습니다'}); // 200이 성공, 400이 실패
    })
})

app.use('/shop', require('./routes/shop.js')); // /shop으로 요청했을 때 미들웨어 적용(shop.js 라우터 이용)
app.use('/board/sub', require('./routes/board.js'));


let multer = require('multer');
var storage = multer.diskStorage({

  destination : function(req, file, cb){
    cb(null, './public/image')
  },
  filename : function(req, file, cb){
    cb(null, file.originalname)
  },filefilter : function(req, file, cb) {

  }
});

var upload = multer({storage : storage});

app.get('/upload', (요청, 응답)=>{
    응답.render('upload.ejs')
});

app.post('/upload', upload.single("profile"), (요청, 응답)=>{ // upload.single은 1개, array는 여러개
    응답.send('업로드완료')
});


app.get('/image/:imageName', (요청, 응답) => {
    응답.sendFile( __dirname + '/public/image/' + 요청.params.imageName )
})


app.get('/chat/:id', function(request, response){
    db.collection('post').findOne({_id : parseInt(request.params.id)}, function(에러, 결과){
        console.log(결과)
        response.render('chat.ejs', { post : 결과 });
    })
})

app.post('/chatroom', islogin, function(요청, 응답){
    
    var 저장할거 = {
        title : '무슨무슨채팅방',
        member : [ObjectId(요청.body.당한사람id), 요청.user._id],
        date : new Date()
    }

    db.collection('chatroom').insertOne(저장할거).then((결과)=>{ // 콜백함수나 then이나 같음
        응답.send('성공')
    })
})

app.get('/chat', islogin, function(요청, 응답){

    db.collection('chatroom').find({ member : 요청.user._id }).toArray().then((결과)=>{
        응답.render('chat.ejs', { data : 결과 })
    })
})

app.post('/message', islogin, function(요청, 응답){
    
    var 저장할거 = {
        parent : 요청.body.parent,
        content : 요청.body.content,
        userid : 요청.user._id,
        date : new Date()
    }
    
    db.collection('message').insertOne(저장할거).then(()=>{
        console.log('db저장성공')
        응답.send('db저장성공')
    })
})

app.get('/message/:id', islogin, function(요청, 응답){

    응답.writeHead(200, { // 유저와 실시간 소통 채널 개설
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });
    
    db.collection('message').find({ parent : 요청.params.id }).toArray()
    .then((결과)=>{
        응답.write('event: test\n');
        응답.write('data:' + JSON.stringify(결과) + '\n\n');
    })
    
    const 찾을문서 = [
        { $match: { 'fullDocument.parent' : 요청.params.id } }
    ];
    
    const collection = db.collection('message');
    const changeStream = collection.watch(찾을문서);
    // watch로 collection을 실시간 감시
    
    changeStream.on('change', (result) => {
        응답.write('event: test\n'); // test이벤트 발동시킴 
        응답.write('data:' + JSON.stringify([result.fullDocument]) + '\n\n');
    });
    
  });