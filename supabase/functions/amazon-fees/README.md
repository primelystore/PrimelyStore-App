# Amazon Fees Edge Function

Esta Edge Function do Supabase realiza a integração com a **Amazon Selling Partner API (SP-API)** para calcular as estimativas de taxas (FBA/Referral) de produtos listados ou não na Amazon.

## Como funciona (Autenticação)
Esta versão realiza a autenticação na AWS utilizando **IAM User + SigV4 Standard**, dispensando a necessidade de assumir a role com o STS (Security Token Service). Isso evita erros de validação de signature associados a assumir roles temporárias caso as credenciais root expirem ou sejam imprecisas. 

## Como fazer o Deploy localmente e enviar para o Supabase

Certifique-se de que você possui a [CLI do Supabase](https://supabase.com/docs/guides/cli) instalada e esteja logado (`supabase login`).

Para realizar o deploy desta function para o seu projeto configurado no Supabase, execute a partir da raiz do repositório:

```bash
supabase functions deploy amazon-fees --project-ref <SEU_PROJECT_REF_DO_SUPABASE> --no-verify-jwt
```
*A flag `--no-verify-jwt` instrui o Supabase a permitir que a sua aplicação Front-end chame a função de forma pública caso você esteja validando o usuário dentro da função (aqui utilizamos headers de cors customizados em conjunto).* Se preferir utilizar o Autenticador JWT padrão, não use esta flag e envie o token bearer na request.

## Secrets necessários
Para que a função se autentique na Amazon SP-API e na AWS, você deve configurar os seguintes secrets na Dashboard do Supabase (Project Settings > Edge Functions > Secrets) ou localmente `.env.local` usando `supabase secrets set --env-file .env.local`:

- `SPAPI_LWA_CLIENT_ID` (App LWA Client ID)
- `SPAPI_LWA_CLIENT_SECRET` (App LWA Client Secret)
- `SPAPI_REFRESH_TOKEN` (LWA Refresh Token autorizado para a sua conta seller)
- `SPAPI_AWS_ACCESS_KEY_ID` (Key ID do seu IAM User gerado na AWS)
- `SPAPI_AWS_SECRET_ACCESS_KEY` (Secret Access Key do seu IAM User gerado na AWS)
- `SPAPI_MARKETPLACE_ID` (Opcional, Padrão: `"A2Q3Y263D00KWC"` - Brasil)
- `SPAPI_HOST` (Opcional, Padrão: `"sellingpartnerapi-na.amazon.com"`)
- `SPAPI_REGION` (Opcional, Padrão: `"us-east-1"`)

## Formato do Request Body
Esta rota suporta e entende tanto a estrutura que passava `identifier` + `idType` como as entradas diretas de `sku` e `asin`.

### Exemplo 1: Utilizando SKU ou ASIN diretamente
```json
{
  "asin": "B0CDYZ2LNN",
  "price": 89.90,
  "fulfillment": "FBA"
}
```

### Exemplo 2: Utilizando a estrutura padrão antiga
```json
{
  "identifier": "MEU-SKU-TESTE-123",
  "idType": "SKU",
  "price": 120.00,
  "fulfillment": "FBM"
}
```

### Sucesso - Payload Response:
```json
{
  "marketplaceId": "A2Q3Y263D00KWC",
  "idType": "ASIN",
  "identifier": "B0CDYZ2LNN",
  "fulfillment": "FBA",
  "totalFees": 26.54,
  "referralFee": 14.38,
  "fulfillmentFee": 12.16,
  "otherFeesTotal": 0,
  "feeDetailList": [...],
  "source": "LIVE"
}
```
