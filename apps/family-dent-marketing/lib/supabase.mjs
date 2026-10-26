export const configured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
export async function supabase(path, {token,method='GET',body,service=false,prefer}={}) {
  const key = service ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY;
  if (!process.env.SUPABASE_URL || !key) throw Object.assign(new Error('Supabase не настроен.'),{status:503});
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`,{
    method,headers:{apikey:key,Authorization:`Bearer ${token || key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(()=>null);
  if (!response.ok) {
    // Never relay upstream messages that may contain submitted data or tokens.
    const status = response.status === 401 ? 401 : response.status === 403 ? 403 : response.status === 409 ? 409 : 400;
    throw Object.assign(new Error(status===409?'Такая запись уже существует.':status===401?'Войдите в приложение заново.':status===403?'Недостаточно прав.':'Не удалось сохранить или получить данные. Проверьте поля и настройку базы.'),{status});
  }
  return data;
}
export const db = (table,options={}) => supabase(`/rest/v1/${table}`,options);
export async function allRows(table,options={}) {
  const rows=[];
  for(let offset=0;;offset+=500) {
    const page=await db(`${table}${table.includes('?')?'&':'?'}limit=500&offset=${offset}`,options);
    rows.push(...page);
    if(page.length<500) return rows;
    if(offset>=49500) throw Object.assign(new Error('Слишком большой отчёт. Выберите более короткий период.'),{status:400});
  }
}
