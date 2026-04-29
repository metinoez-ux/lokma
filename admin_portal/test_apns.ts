import * as admin from 'firebase-admin';
const msg: admin.messaging.Message = {
  token: 'abc',
  apns: {
    payload: { aps: { mutableContent: true } },
    fcmOptions: { imageUrl: 'https://test.com/img.jpg' }
  }
};
console.log(msg);
