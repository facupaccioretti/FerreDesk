// This is a Node.js script to create the necessary tables in Supabase
// You can run this in the Supabase SQL Editor

console.log(`
-- PostgreSQL schema for Supabase based on Firebird schema

-- Table: BARRIOS
CREATE TABLE barrios (
  BAR_ID SERIAL PRIMARY KEY,
  BAR_NOMBRE VARCHAR(40) NOT NULL
);

-- Table: LOCALIDADES
CREATE TABLE localidades (
  LOC_ID SERIAL PRIMARY KEY,
  LOC_NOMBRE VARCHAR(40) NOT NULL
);

-- Table: PROVINCIAS
CREATE TABLE provincias (
  PRV_ID SERIAL PRIMARY KEY,
  PRV_NOMBRE VARCHAR(40) NOT NULL
);

-- Table: TRANSPORTES
CREATE TABLE transportes (
  TRA_ID SERIAL PRIMARY KEY,
  TRA_NOMBRE VARCHAR(40) NOT NULL
);

-- Table: VENDEDORES
CREATE TABLE vendedores (
  VDO_ID SERIAL PRIMARY KEY,
  VDO_NOMBRE VARCHAR(40) NOT NULL
);

-- Table: PLAZOS
CREATE TABLE plazos (
  PLA_ID SERIAL PRIMARY KEY,
  PLA_NOMBRE VARCHAR(40) NOT NULL
);

-- Table: CATEGORIA_CLIENTE
CREATE TABLE categoria_cliente (
  CAC_ID SERIAL PRIMARY KEY,
  CAC_NOMBRE VARCHAR(40) NOT NULL
);

-- Table: CLIENTES
CREATE TABLE clientes (
  CLI_ID INTEGER PRIMARY KEY,
  CLI_RAZON VARCHAR(40) NOT NULL,
  CLI_FANTASIA VARCHAR(40),
  CLI_DOMI VARCHAR(40) NOT NULL,
  CLI_TEL1 VARCHAR(12),
  CLI_TEL2 VARCHAR(12),
  CLI_TEL3 VARCHAR(12),
  CLI_FAX VARCHAR(12),
  CLI_EMAIL VARCHAR(50),
  CLI_CUIT VARCHAR(11),
  CLI_IB VARCHAR(10),
  CLI_STATUS SMALLINT,
  CLI_IVA VARCHAR(2),
  CLI_CONTACTO VARCHAR(40),
  CLI_CONTACCO VARCHAR(40),
  CLI_CONTACPA VARCHAR(40),
  CLI_HORARIO VARCHAR(20),
  CLI_COMENTARIO VARCHAR(50),
  CLI_LINEACRED INTEGER NOT NULL,
  CLI_IMPSALCTA NUMERIC(12,2) NOT NULL,
  CLI_FECSALCTA DATE NOT NULL,
  CLI_DESCU1 NUMERIC(4,2),
  CLI_DESCU2 NUMERIC(4,2),
  CLI_DESCU3 NUMERIC(4,2),
  CLI_CPOSTAL VARCHAR(7),
  CLI_ZONA VARCHAR(10) NOT NULL,
  CLI_CANCELA VARCHAR(1),
  CLI_IDBAR INTEGER REFERENCES barrios(BAR_ID),
  CLI_IDLOC INTEGER REFERENCES localidades(LOC_ID),
  CLI_IDPRV INTEGER REFERENCES provincias(PRV_ID),
  CLI_IDTRA INTEGER REFERENCES transportes(TRA_ID),
  CLI_IDVDO INTEGER REFERENCES vendedores(VDO_ID),
  CLI_IDPLA INTEGER REFERENCES plazos(PLA_ID),
  CLI_IDCAC INTEGER REFERENCES categoria_cliente(CAC_ID),
  CLI_ACTI VARCHAR(1),
  IDLOCANT INTEGER
);

-- Create a function to prevent duplicate client names
CREATE OR REPLACE FUNCTION prevent_duplicate_client_name()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM clientes WHERE CLI_RAZON = NEW.CLI_RAZON) > 0 THEN
    RAISE EXCEPTION 'Ya existe un cliente con esta razón social';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to prevent duplicate client names
CREATE TRIGGER check_duplicate_client_name
BEFORE INSERT ON clientes
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_client_name();

-- Enable Row Level Security
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows authenticated users to see all clients
CREATE POLICY "Authenticated users can see all clients"
ON clientes FOR SELECT
TO authenticated
USING (true);

-- Create a policy that allows authenticated users to insert clients
CREATE POLICY "Authenticated users can insert clients"
ON clientes FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create a policy that allows authenticated users to update their clients
CREATE POLICY "Authenticated users can update clients"
ON clientes FOR UPDATE
TO authenticated
USING (true);
`)

