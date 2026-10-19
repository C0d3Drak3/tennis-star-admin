CREATE OR REPLACE FUNCTION enforce_two_level_category_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_parent_id TEXT;
BEGIN
  IF NEW."parentId" IS NOT NULL THEN
    IF NEW."parentId" = NEW."id" THEN
      RAISE EXCEPTION 'A category cannot be its own parent.'
        USING ERRCODE = '23514';
    END IF;

    SELECT "parentId"
    INTO parent_parent_id
    FROM "Category"
    WHERE "id" = NEW."parentId"
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The parent category does not exist.'
        USING ERRCODE = '23503';
    END IF;
    IF parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'A subcategory cannot be used as a parent category.'
        USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'INSERT'
      OR (TG_OP = 'UPDATE' AND OLD."parentId" IS DISTINCT FROM NEW."parentId")
    THEN
      IF EXISTS (
        SELECT 1 FROM "Category" child
        WHERE child."parentId" = NEW."id"
      ) OR EXISTS (
        SELECT 1 FROM "Product" product
        WHERE product."categoryId" = NEW."id"
           OR product."subcategoryId" = NEW."id"
      ) THEN
        RAISE EXCEPTION 'A category with dependent records cannot become a subcategory.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."parentId" IS DISTINCT FROM NEW."parentId" THEN
    IF EXISTS (
      SELECT 1
      FROM "Product" product
      WHERE product."subcategoryId" = NEW."id"
        AND product."categoryId" IS DISTINCT FROM NEW."parentId"
    ) THEN
      RAISE EXCEPTION 'A subcategory used by products cannot be moved to a different parent.'
        USING ERRCODE = '23514';
    END IF;
    IF NEW."parentId" IS NULL AND EXISTS (
      SELECT 1 FROM "Product" product
      WHERE product."subcategoryId" = NEW."id"
    ) THEN
      RAISE EXCEPTION 'A subcategory used by products cannot become a main category.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
