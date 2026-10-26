import {supabase,db} from '../lib/supabase.mjs';
// Usage: node --env-file=.env scripts/provision-user.mjs email "Имя" leadership
// The user receives a Supabase invitation. No password is printed or stored here.
const [email,display_name,role='staff']=process.argv.slice(2);
if(!email||!display_name||!['marketer','leadership','staff','doctor','it'].includes(role)){
 console.error('Укажите: email "Имя" role (marketer/leadership/staff/doctor/it)');process.exit(1);
}
try{
 const user=await supabase('/auth/v1/invite',{service:true,method:'POST',body:{email,data:{display_name},redirect_to:process.env.APP_URL}});
 await db('profiles',{service:true,method:'POST',body:{id:user.id,display_name,role,active:true},prefer:'resolution=merge-duplicates'});
 console.log('Приглашение отправлено. Профиль и роль созданы.');
}catch{console.error('Не удалось создать приглашение. Проверьте настройки Supabase, SMTP и наличие пользователя. Для существующего пользователя добавьте профиль по auth.users.id через SQL Editor.');process.exitCode=1;}
