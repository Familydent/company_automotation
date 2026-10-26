begin;
insert into public.directions(id,name,short_name,color,description) values
 ('10000000-0000-4000-8000-000000000001','Стоматологическая клиника','Клиника','#63866d','Узнаваемость бренда, новые пациенты и возвращение существующих'),
 ('10000000-0000-4000-8000-000000000002','Академия Family Dent','Академия','#b78b54','Курсы, мастер-классы и сообщество стоматологов'),
 ('10000000-0000-4000-8000-000000000003','Медицинский туризм','Медтуризм','#6d98ad','Пациенты из-за границы и партнёрская сеть'),
 ('10000000-0000-4000-8000-000000000004','Цифровая лаборатория','Лаборатория','#8e83b4','Цифровые технологии, заказы и партнёры'),
 ('10000000-0000-4000-8000-000000000005','Диагностический центр','Диагностика','#c17f69','КЛКТ, диагностика и направления от врачей'),
 ('10000000-0000-4000-8000-000000000006','Детское отделение и хирургия','Новое отделение','#c39aae','Подготовка открытия, детская стоматология и хирургия') on conflict(id) do nothing;
insert into public.branches(id,name) values('20000000-0000-4000-8000-000000000001','Айни'),('20000000-0000-4000-8000-000000000002','Молодёжный') on conflict(id) do nothing;
insert into public.categories(kind,name) values ('source','Instagram'),('source','Facebook'),('source','Рекомендация'),('source','Карты и поиск'),('source','Партнёр'),('source','Не установлен'),('expense','Таргетная реклама'),('expense','Производство контента'),('expense','Оборудование'),('expense','Печатные материалы'),('expense','Мероприятия'),('service','Детская стоматология'),('service','Хирургия'),('format','Рилс'),('format','Карусель'),('format','Пост'),('format','Сторис') on conflict(kind,name) do nothing;
insert into public.social_accounts(direction_id,platform,handle,url) values
 ('10000000-0000-4000-8000-000000000001','instagram','familydent.tj','https://www.instagram.com/familydent.tj/'),
 ('10000000-0000-4000-8000-000000000002','instagram','family_dent_academy','https://www.instagram.com/family_dent_academy/'),
 ('10000000-0000-4000-8000-000000000003','instagram','familydent.medtour','https://www.instagram.com/familydent.medtour/'),
 ('10000000-0000-4000-8000-000000000004','instagram','family_dent_digital.lab','https://www.instagram.com/family_dent_digital.lab/'),
 ('10000000-0000-4000-8000-000000000005','instagram','family_diagnostic.dyu','https://www.instagram.com/family_diagnostic.dyu/'),
 ('10000000-0000-4000-8000-000000000001','facebook','familydentdushanbe','https://www.facebook.com/familydentdushanbe/'),
 (null,'facebook','61589742206561','https://www.facebook.com/profile.php?id=61589742206561') on conflict(platform,handle) do nothing;
commit;
