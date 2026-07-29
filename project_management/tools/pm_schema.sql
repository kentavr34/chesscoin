--
-- PostgreSQL database dump
--

\restrict r5b5vjme9GEZmvEG2BqCZLJU5aHZB0IcLgpnUK1huGoldx30PhCRUOJaOjV03GN

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: chesscoin_pm; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA chesscoin_pm;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agent_mistakes; Type: TABLE; Schema: chesscoin_pm; Owner: -
--

CREATE TABLE chesscoin_pm.agent_mistakes (
    id integer NOT NULL,
    happened_on date,
    mistake text NOT NULL,
    kenan_quote text,
    root_cause text,
    rule text,
    prevented_by text,
    repeat_count integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_mistakes_id_seq; Type: SEQUENCE; Schema: chesscoin_pm; Owner: -
--

CREATE SEQUENCE chesscoin_pm.agent_mistakes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_mistakes_id_seq; Type: SEQUENCE OWNED BY; Schema: chesscoin_pm; Owner: -
--

ALTER SEQUENCE chesscoin_pm.agent_mistakes_id_seq OWNED BY chesscoin_pm.agent_mistakes.id;


--
-- Name: change_log; Type: TABLE; Schema: chesscoin_pm; Owner: -
--

CREATE TABLE chesscoin_pm.change_log (
    id integer NOT NULL,
    commit_sha character varying(40),
    ts timestamp with time zone,
    author text,
    subject text,
    files_count integer,
    imported_at timestamp with time zone DEFAULT now()
);


--
-- Name: change_log_id_seq; Type: SEQUENCE; Schema: chesscoin_pm; Owner: -
--

CREATE SEQUENCE chesscoin_pm.change_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: chesscoin_pm; Owner: -
--

ALTER SEQUENCE chesscoin_pm.change_log_id_seq OWNED BY chesscoin_pm.change_log.id;


--
-- Name: chat_history; Type: TABLE; Schema: chesscoin_pm; Owner: -
--

CREATE TABLE chesscoin_pm.chat_history (
    id bigint NOT NULL,
    src_id integer,
    ts timestamp without time zone,
    role character varying(20),
    text text,
    text_summary character varying(500),
    category character varying(40),
    importance integer,
    tags text[],
    session_id character varying(100),
    imported_at timestamp with time zone DEFAULT now()
);


--
-- Name: chat_history_id_seq; Type: SEQUENCE; Schema: chesscoin_pm; Owner: -
--

CREATE SEQUENCE chesscoin_pm.chat_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_history_id_seq; Type: SEQUENCE OWNED BY; Schema: chesscoin_pm; Owner: -
--

ALTER SEQUENCE chesscoin_pm.chat_history_id_seq OWNED BY chesscoin_pm.chat_history.id;


--
-- Name: file_inventory; Type: TABLE; Schema: chesscoin_pm; Owner: -
--

CREATE TABLE chesscoin_pm.file_inventory (
    id bigint NOT NULL,
    scanned_at timestamp with time zone DEFAULT now(),
    contour text,
    path text,
    size bigint,
    mtime timestamp with time zone,
    sha text,
    kind text
);


--
-- Name: file_inventory_id_seq; Type: SEQUENCE; Schema: chesscoin_pm; Owner: -
--

CREATE SEQUENCE chesscoin_pm.file_inventory_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: file_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: chesscoin_pm; Owner: -
--

ALTER SEQUENCE chesscoin_pm.file_inventory_id_seq OWNED BY chesscoin_pm.file_inventory.id;


--
-- Name: operations_log; Type: TABLE; Schema: chesscoin_pm; Owner: -
--

CREATE TABLE chesscoin_pm.operations_log (
    id integer NOT NULL,
    ts timestamp with time zone DEFAULT now(),
    session_id integer,
    kind text DEFAULT 'note'::text,
    text text NOT NULL,
    files text[]
);


--
-- Name: operations_log_id_seq; Type: SEQUENCE; Schema: chesscoin_pm; Owner: -
--

CREATE SEQUENCE chesscoin_pm.operations_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operations_log_id_seq; Type: SEQUENCE OWNED BY; Schema: chesscoin_pm; Owner: -
--

ALTER SEQUENCE chesscoin_pm.operations_log_id_seq OWNED BY chesscoin_pm.operations_log.id;


--
-- Name: problem_solutions; Type: TABLE; Schema: chesscoin_pm; Owner: -
--

CREATE TABLE chesscoin_pm.problem_solutions (
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    problem text NOT NULL,
    keywords text[],
    root_cause text,
    solution_steps jsonb,
    files_touched text[],
    notes text,
    rating integer,
    verified_at timestamp with time zone,
    effective boolean DEFAULT true,
    src text
);


--
-- Name: problem_solutions_id_seq; Type: SEQUENCE; Schema: chesscoin_pm; Owner: -
--

CREATE SEQUENCE chesscoin_pm.problem_solutions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: problem_solutions_id_seq; Type: SEQUENCE OWNED BY; Schema: chesscoin_pm; Owner: -
--

ALTER SEQUENCE chesscoin_pm.problem_solutions_id_seq OWNED BY chesscoin_pm.problem_solutions.id;


--
-- Name: prod_path_registry; Type: TABLE; Schema: chesscoin_pm; Owner: -
--

CREATE TABLE chesscoin_pm.prod_path_registry (
    id integer NOT NULL,
    subsystem text NOT NULL,
    prod_path text NOT NULL,
    how_to_test text,
    trap text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: prod_path_registry_id_seq; Type: SEQUENCE; Schema: chesscoin_pm; Owner: -
--

CREATE SEQUENCE chesscoin_pm.prod_path_registry_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prod_path_registry_id_seq; Type: SEQUENCE OWNED BY; Schema: chesscoin_pm; Owner: -
--

ALTER SEQUENCE chesscoin_pm.prod_path_registry_id_seq OWNED BY chesscoin_pm.prod_path_registry.id;


--
-- Name: regression_cases; Type: TABLE; Schema: chesscoin_pm; Owner: -
--

CREATE TABLE chesscoin_pm.regression_cases (
    id integer NOT NULL,
    tema text NOT NULL,
    kind text DEFAULT 'api'::text NOT NULL,
    check_cmd text,
    must_contain text,
    must_not text,
    proven_at date,
    origin text,
    active boolean DEFAULT true
);


--
-- Name: regression_cases_id_seq; Type: SEQUENCE; Schema: chesscoin_pm; Owner: -
--

CREATE SEQUENCE chesscoin_pm.regression_cases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regression_cases_id_seq; Type: SEQUENCE OWNED BY; Schema: chesscoin_pm; Owner: -
--

ALTER SEQUENCE chesscoin_pm.regression_cases_id_seq OWNED BY chesscoin_pm.regression_cases.id;


--
-- Name: regression_runs; Type: TABLE; Schema: chesscoin_pm; Owner: -
--

CREATE TABLE chesscoin_pm.regression_runs (
    id integer NOT NULL,
    case_id integer,
    ts timestamp with time zone DEFAULT now(),
    passed boolean,
    note text
);


--
-- Name: regression_runs_id_seq; Type: SEQUENCE; Schema: chesscoin_pm; Owner: -
--

CREATE SEQUENCE chesscoin_pm.regression_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regression_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: chesscoin_pm; Owner: -
--

ALTER SEQUENCE chesscoin_pm.regression_runs_id_seq OWNED BY chesscoin_pm.regression_runs.id;


--
-- Name: session_log; Type: TABLE; Schema: chesscoin_pm; Owner: -
--

CREATE TABLE chesscoin_pm.session_log (
    id integer NOT NULL,
    agent text DEFAULT 'claude'::text NOT NULL,
    purpose text,
    opened_at timestamp with time zone DEFAULT now(),
    closed_at timestamp with time zone,
    summary text
);


--
-- Name: session_log_id_seq; Type: SEQUENCE; Schema: chesscoin_pm; Owner: -
--

CREATE SEQUENCE chesscoin_pm.session_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: session_log_id_seq; Type: SEQUENCE OWNED BY; Schema: chesscoin_pm; Owner: -
--

ALTER SEQUENCE chesscoin_pm.session_log_id_seq OWNED BY chesscoin_pm.session_log.id;


--
-- Name: agent_mistakes id; Type: DEFAULT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.agent_mistakes ALTER COLUMN id SET DEFAULT nextval('chesscoin_pm.agent_mistakes_id_seq'::regclass);


--
-- Name: change_log id; Type: DEFAULT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.change_log ALTER COLUMN id SET DEFAULT nextval('chesscoin_pm.change_log_id_seq'::regclass);


--
-- Name: chat_history id; Type: DEFAULT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.chat_history ALTER COLUMN id SET DEFAULT nextval('chesscoin_pm.chat_history_id_seq'::regclass);


--
-- Name: file_inventory id; Type: DEFAULT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.file_inventory ALTER COLUMN id SET DEFAULT nextval('chesscoin_pm.file_inventory_id_seq'::regclass);


--
-- Name: operations_log id; Type: DEFAULT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.operations_log ALTER COLUMN id SET DEFAULT nextval('chesscoin_pm.operations_log_id_seq'::regclass);


--
-- Name: problem_solutions id; Type: DEFAULT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.problem_solutions ALTER COLUMN id SET DEFAULT nextval('chesscoin_pm.problem_solutions_id_seq'::regclass);


--
-- Name: prod_path_registry id; Type: DEFAULT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.prod_path_registry ALTER COLUMN id SET DEFAULT nextval('chesscoin_pm.prod_path_registry_id_seq'::regclass);


--
-- Name: regression_cases id; Type: DEFAULT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.regression_cases ALTER COLUMN id SET DEFAULT nextval('chesscoin_pm.regression_cases_id_seq'::regclass);


--
-- Name: regression_runs id; Type: DEFAULT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.regression_runs ALTER COLUMN id SET DEFAULT nextval('chesscoin_pm.regression_runs_id_seq'::regclass);


--
-- Name: session_log id; Type: DEFAULT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.session_log ALTER COLUMN id SET DEFAULT nextval('chesscoin_pm.session_log_id_seq'::regclass);


--
-- Name: agent_mistakes agent_mistakes_pkey; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.agent_mistakes
    ADD CONSTRAINT agent_mistakes_pkey PRIMARY KEY (id);


--
-- Name: change_log change_log_commit_sha_key; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.change_log
    ADD CONSTRAINT change_log_commit_sha_key UNIQUE (commit_sha);


--
-- Name: change_log change_log_pkey; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.change_log
    ADD CONSTRAINT change_log_pkey PRIMARY KEY (id);


--
-- Name: chat_history chat_history_pkey; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.chat_history
    ADD CONSTRAINT chat_history_pkey PRIMARY KEY (id);


--
-- Name: file_inventory file_inventory_pkey; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.file_inventory
    ADD CONSTRAINT file_inventory_pkey PRIMARY KEY (id);


--
-- Name: operations_log operations_log_pkey; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.operations_log
    ADD CONSTRAINT operations_log_pkey PRIMARY KEY (id);


--
-- Name: problem_solutions problem_solutions_pkey; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.problem_solutions
    ADD CONSTRAINT problem_solutions_pkey PRIMARY KEY (id);


--
-- Name: prod_path_registry prod_path_registry_pkey; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.prod_path_registry
    ADD CONSTRAINT prod_path_registry_pkey PRIMARY KEY (id);


--
-- Name: prod_path_registry prod_path_registry_subsystem_key; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.prod_path_registry
    ADD CONSTRAINT prod_path_registry_subsystem_key UNIQUE (subsystem);


--
-- Name: regression_cases regression_cases_pkey; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.regression_cases
    ADD CONSTRAINT regression_cases_pkey PRIMARY KEY (id);


--
-- Name: regression_runs regression_runs_pkey; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.regression_runs
    ADD CONSTRAINT regression_runs_pkey PRIMARY KEY (id);


--
-- Name: session_log session_log_pkey; Type: CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.session_log
    ADD CONSTRAINT session_log_pkey PRIMARY KEY (id);


--
-- Name: ix_cc_change_ts; Type: INDEX; Schema: chesscoin_pm; Owner: -
--

CREATE INDEX ix_cc_change_ts ON chesscoin_pm.change_log USING btree (ts);


--
-- Name: ix_cc_chat_ts; Type: INDEX; Schema: chesscoin_pm; Owner: -
--

CREATE INDEX ix_cc_chat_ts ON chesscoin_pm.chat_history USING btree (ts);


--
-- Name: ix_cc_inv_path; Type: INDEX; Schema: chesscoin_pm; Owner: -
--

CREATE INDEX ix_cc_inv_path ON chesscoin_pm.file_inventory USING btree (path);


--
-- Name: ix_cc_inv_scan; Type: INDEX; Schema: chesscoin_pm; Owner: -
--

CREATE INDEX ix_cc_inv_scan ON chesscoin_pm.file_inventory USING btree (scanned_at);


--
-- Name: ux_cc_chat_src; Type: INDEX; Schema: chesscoin_pm; Owner: -
--

CREATE UNIQUE INDEX ux_cc_chat_src ON chesscoin_pm.chat_history USING btree (src_id);


--
-- Name: regression_runs regression_runs_case_id_fkey; Type: FK CONSTRAINT; Schema: chesscoin_pm; Owner: -
--

ALTER TABLE ONLY chesscoin_pm.regression_runs
    ADD CONSTRAINT regression_runs_case_id_fkey FOREIGN KEY (case_id) REFERENCES chesscoin_pm.regression_cases(id);


--
-- PostgreSQL database dump complete
--

\unrestrict r5b5vjme9GEZmvEG2BqCZLJU5aHZB0IcLgpnUK1huGoldx30PhCRUOJaOjV03GN

