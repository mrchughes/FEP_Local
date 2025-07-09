import os
from langchain.document_loaders import DirectoryLoader, PyPDFLoader, Docx2txtLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import OllamaEmbeddings
from langchain.vectorstores import Chroma
from dotenv import load_dotenv

load_dotenv()
docs_path = "docs"
persist_dir = "chroma_db"

# Load all docs
def get_loader(p):
    if p.endswith(".pdf"):
        return PyPDFLoader(p)
    elif p.endswith(".docx"):
        return Docx2txtLoader(p)
    else:
        return TextLoader(p)

loader = DirectoryLoader(
    docs_path,
    glob="**/*",
    loader_cls=get_loader
)
docs = loader.load()

# Split
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
splits = splitter.split_documents(docs)

# Embed and store
embeddings = OllamaEmbeddings(model="phi3:mini", base_url="http://localhost:11434")
db = Chroma.from_documents(splits, embeddings, persist_directory=persist_dir)
db.persist()
print("Ingestion complete.")
