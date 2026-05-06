-- Agregar columnas cloudinary_ids para cleanup de imágenes al eliminar

-- Prendas: array de publicIds de Cloudinary (pueden tener hasta 5 fotos)
alter table prendas add column if not exists cloudinary_ids text[] default '{}';

-- Drops: publicId de la foto de portada
alter table drops add column if not exists portada_cloudinary_id text;

-- Tiendas: publicId del logo y cover
alter table tiendas add column if not exists logo_cloudinary_id text;
alter table tiendas add column if not exists cover_cloudinary_id text;
