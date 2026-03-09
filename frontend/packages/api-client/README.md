# API Client 规划

统一封装：
- Token 注入
- 响应错误处理
- 接口类型定义

可按以下方式组织：

- `src/http.ts` Axios 实例
- `src/modules/doctor.ts`
- `src/modules/patient.ts`
- `src/modules/ai.ts`
