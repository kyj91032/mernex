var router = require('express').Router();

function islogin(request, response, next){
    if(request.user){ // request.user는 로그인 한 상태이면 항상 있음
        next() // 통과
    } else {
        response.send('로그인 안하심')
    }
}

router.use('/shirts', islogin); // 미들웨어 전체 추가

router.get('/shirts', (요청, 응답) => {
    응답.send('셔츠 파는 페이지입니다.')
});

router.get('/pants', (요청, 응답) => {
    응답.send('바지 파는 페이지입니다.')
});

module.exports = router;
