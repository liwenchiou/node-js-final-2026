// 統一集中管理各種正則表達式驗證，免得到處複製貼上
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,16}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = {
  isValidUUID: (id) => {
    return typeof id === 'string' && uuidRegex.test(id);
  },
  isValidPassword: (password) => {
    return typeof password === 'string' && passwordRegex.test(password);
  },
  isValidEmail: (email) => {
    return typeof email === 'string' && emailRegex.test(email);
  },
  isValidString: (str, maxLength = 50) => {
    return typeof str === 'string' && str.trim().length > 0 && str.length <= maxLength;
  }
};
