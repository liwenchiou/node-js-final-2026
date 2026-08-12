/**
 * 統一成功回應格式
 * @param {Response} res Express Response object
 * @param {number} statusCode HTTP 狀態碼 (預設 200)
 * @param {object|array} data 回傳的資料內容
 */
const sendSuccess = (res, statusCode = 200, data = {}) => {
  res.status(statusCode).json({
    status: 'success',
    data,
  });
};

/**
 * 統一失敗回應格式
 * @param {Response} res Express Response object
 * @param {number} statusCode HTTP 狀態碼 (預設 400)
 * @param {string} message 錯誤訊息
 */
const sendFailed = (res, statusCode = 400, message = 'Operation failed') => {
  res.status(statusCode).json({
    status: 'failed',
    message,
  });
};

/**
 * 處理 Try-Catch 中的預期外錯誤 (500)
 * @param {Response} res Express Response object
 * @param {Error} error Error object
 */
const sendError = (res, error) => {
  console.error('API Error:', error);
  res.status(500).json({
    status: 'error', // 這裡遵循標準系統錯誤拋出 (M0-M6 主要看業務邏輯的 failed，但 500 通常仍用 error，或依 README 回傳 failed 也可以。這裡配合文件一律用 failed)
    message: '伺服器發生未預期錯誤',
  });
};

module.exports = {
  sendSuccess,
  sendFailed,
  sendError,
};
