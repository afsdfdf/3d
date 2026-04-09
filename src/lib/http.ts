export async function parseJsonResponse<T>(
  response: Response,
): Promise<T | { error: string }> {
  const text = await response.text();

  if (!text.trim()) {
    return {
      error: response.ok
        ? "服务端返回了空响应。"
        : `请求失败（HTTP ${response.status}）。`,
    };
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      error: response.ok
        ? "服务端返回的数据格式不正确。"
        : text.slice(0, 200),
    };
  }
}
