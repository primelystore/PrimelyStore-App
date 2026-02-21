# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Guia Rápido: Como Publicar (Deploy) Edge Functions no Supabase

Para utilizar os recursos da Calculadora da Amazon (e outras opções vinculadas a Deno/Edge Functions), é necessário rodar o deploy na plataforma Supabase.

1. **Faça o login no Supabase CLI** (usará o browser para autorizar):
   ```bash
   npm run supabase:login
   ```

2. **Vincule a pasta local com o seu projeto Supabase**
   _Substitua SEU_PROJECT_REF pelo ID (Ref) do seu projeto (visível na URL do painel do Supabase)._
   ```bash
   npm run supabase:link SEU_PROJECT_REF
   ```

3. **Inicie o Deploy das Edge Functions**
   O comando enviará todas as funções dentro de `supabase/functions/` para o servidor.
   ```bash
   npm run supabase:deploy:functions
   ```

**Nota sobre Variavéis de Ambiente (Secrets)**:
A função `amazon-fees` precisa das credenciais da SP-API. Lembre-se de defini-las online no painel do Supabase ([Dashboard -> Edge Functions -> Secrets]):
- `SPAPI_LWA_CLIENT_ID`
- `SPAPI_LWA_CLIENT_SECRET`
- `SPAPI_REFRESH_TOKEN`
- `SPAPI_AWS_ACCESS_KEY_ID`
- `SPAPI_AWS_SECRET_ACCESS_KEY`
- `SPAPI_ROLE_ARN`

## Testando Integridade das Funções Front x Backend

Para atestar que as funções foram publicadas perfeitamente, criamos o endpoint `amazon-ping`. Você poderá testá-lo executando:
```javascript
// Exemplo abrindo no Chrome Inspect Tool
const res = await supabase.functions.invoke("amazon-ping");
console.log(res);
```

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
