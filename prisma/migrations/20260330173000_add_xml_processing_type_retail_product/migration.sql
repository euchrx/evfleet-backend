DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'XmlProcessingType'
      AND e.enumlabel = 'RETAIL_PRODUCT'
  ) THEN
    ALTER TYPE "XmlProcessingType" ADD VALUE 'RETAIL_PRODUCT';
  END IF;
END
$$;
