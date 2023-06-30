const nodemailer = require('nodemailer');
const LOGGER = require('./logger.js');

const {userMail, passwordMail} = require('./config.js')


const transporter = nodemailer.createTransport({
    secure: true,
    service: 'gmail',
    auth: {
      user: userMail,
      pass: passwordMail
    }
  });

  function sendResetPasswordMail(receiver, link) {
    const mailOptions = {
        from: userMail,
        to: receiver,
        subject: 'Rénitialisation de votre mot de passe',
        text: `Votre compte a reçu une demande de rénitialisation de mot de passe.
        Si vous n'êtes pas à l'origine de cette action, vous pouvez ignorer ce mail
        \n\nVoici le lien pour rénitialiser votre mot de passe : http://localhost:3000/psw?tokenPwd=${link}
        \nCordialement,
        \nL'équipe Web IIA 2023`
      };
    
    
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Erreur in the sending of the mail :' + error);
        } else {
          LOGGER('E-mail of reset pwd sent :' + info.response);
        }
      });
}

module.exports = {
    sendResetPasswordMail
}