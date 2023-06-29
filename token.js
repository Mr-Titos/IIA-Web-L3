const jwt = require('jsonwebtoken');
const {secretKey, timeToExpire} = require('./config.js')

function createToken(user) {
    return jwt.sign({
        id: user.id,
        userName : user.userName,
        grade : user.grade,
        email : user.email}, secretKey);
}

function verifyToken(token) {
    const decodedToken = jwt.verify(token, secretKey);
    if (decodedToken == undefined || decodedToken.iat == undefined) {
        return false;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime <= decodedToken.iat + timeToExpire;
}

function getDecodedToken(token) {
    const decodedToken = jwt.verify(token, secretKey);
    if (decodedToken == undefined || decodedToken.iat == undefined) {
        return null;
    } else {
        return decodedToken;
    }
}

module.exports = {
    createToken,
    verifyToken,
    getDecodedToken
}