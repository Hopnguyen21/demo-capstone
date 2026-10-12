-- Chuyen doi toan bo boi canh sang canh tac ruong luong / trong dat ngoai troi (OpenField / Soil)
-- Khong su dung he thong thuy canh (Hydroponic / NFT)

-- 1. Cap nhat Farm sang canh tac luong dat
UPDATE farms 
SET name = 'Nong Trai Canh Tac Luong Dat Don Duong',
    farming_type = 'OpenField'
WHERE id = '30000000-0000-0000-0000-000000000003';

UPDATE farms 
SET name = 'Trang Trai Canh Tac Luong Dat Cau Dat',
    farming_type = 'OpenField'
WHERE id = '30000000-0000-0000-0000-000000000002';

UPDATE farms 
SET name = 'Nong Trai Canh Tac Dat Mau',
    farming_type = 'OpenField'
WHERE id = '30000000-0000-0000-0000-000000000001';

-- 2. Cap nhat Fields
UPDATE fields 
SET name = 'Khu Luong Dat Trong Ngoai Troi Lo A'
WHERE id = '31000000-0000-0000-0000-000000000002';

UPDATE fields 
SET name = 'Khu Luong Dat Dau Tay Lo B'
WHERE id = '31000000-0000-0000-0000-000000000003';

UPDATE fields 
SET name = 'Khu Luong Dat Ca Chua Lo C'
WHERE id = '31000000-0000-0000-0000-000000000004';

-- 3. Cap nhat Zones thanh Luong trong dat
UPDATE zones 
SET name = 'Luong 01 - Trong Dat Xa Lach Cuon',
    zone_type = 'OpenField'
WHERE id = '32000000-0000-0000-0000-000000000002';

UPDATE zones 
SET name = 'Luong 02 - Trong Dat Dau Tay Hana',
    zone_type = 'OpenField'
WHERE id = '32000000-0000-0000-0000-000000000003';

UPDATE zones 
SET name = 'Luong 03 - Trong Dat Ca Chua Chuong F1',
    zone_type = 'OpenField'
WHERE id = '32000000-0000-0000-0000-000000000004';

UPDATE zones 
SET name = 'Luong 00 - Canh Tac Dat Dua Leo Mau',
    zone_type = 'OpenField'
WHERE id = '32000000-0000-0000-0000-000000000001';

-- 4. Cap nhat ten vu mua & cay trong
UPDATE planting_seasons 
SET name = 'Vu Xa Lach Cuon Trong Dat - Q4/2026'
WHERE zone_id = '32000000-0000-0000-0000-000000000002';

UPDATE crops 
SET name = 'Xa Lach Cuon Trong Dat'
WHERE id = '10000000-0000-0000-0000-000000000003';
