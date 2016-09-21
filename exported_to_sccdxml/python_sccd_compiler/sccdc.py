import argparse
import os
import sys
from generic_generator import GenericGenerator, Platforms
from utils import Enum, Logger, FileWriter
from super_class_linker import SuperClassLinker
from state_linker import StateLinker
from path_calculator import PathCalculator
from sccd_constructs import ClassDiagram
from generic_language_constructs import GenericConstruct
from compiler_exceptions import CompilerException

from javascript_writer import JavascriptWriter
from python_writer import PythonWriter

def generate(input_file, output_file, target_language, platform):
	sccd = xmlToSccd(input_file)

	if not target_language:
		if sccd.language:
			target_language = sccd.language
		else:
			target_language = "python" # default
	elif sccd.language and target_language != sccd.language:
		Logger.showError("Diagram specifies target language as \"" + sccd.language + "\", but language option of compiler has been set to \"" + target_language + "\". No output has been generated.")
		return

	if target_language == "python" and not output_file.endswith(".py") :
		output_file += ".py"
	elif target_language == "javascript" and not output_file.endswith(".js") :
		output_file += ".js"

	generic = sccdToGeneric(sccd, platform)
	genericToTarget(generic, target_language, output_file)

def xmlToSccd(xml_file):
	cd = ClassDiagram(xml_file) # create AST
	cd.accept(SuperClassLinker())
	#SuperClassLinker().visit(cd) # visitor linking super classs references
	StateLinker().visit(cd) # visitor fixing state references
	PathCalculator().visit(cd) # visitor calculating paths
	return cd
	
def sccdToGeneric(sccd, platform):
	succesfull_generation = False
	generator = GenericGenerator(platform)
	sccd.accept(generator)
	generic = generator.get()
	Logger.showInfo("Classes <" + ", ".join(sccd.class_names) + "> have been converted to generic language constructs.")
	return generic

def genericToTarget(generic, target_language, output_file):
	try:
		f = FileWriter(output_file)
		if target_language == "javascript":
			writer = JavascriptWriter(f)
		elif target_language == "python":
			writer = PythonWriter(f)
		else:
			raise Exception("Language not supported")
		generic.accept(writer)
		Logger.showInfo("Generic language constructs have been converted to target language constructs and have been written to file '" + output_file + "'.")
	finally:
		f.close()
		
def main():
	parser = argparse.ArgumentParser()
	parser.add_argument('input', help='The path to the XML file to be compiled.')
	parser.add_argument('-o', '--output', type=str, help='The path to the generated code. Defaults to the same name as the input file but with matching extension.')
	parser.add_argument('-v', '--verbose', type=int, help='2 = all output; 1 = only warnings and errors; 0 = only errors; -1 = no output.  Defaults to 2.', default = 2)
	parser.add_argument('-p', '--platform', type=str, help="Let the compiled code run on top of threads, gameloop or eventloop. The default is eventloop.")
	parser.add_argument('-l', '--language', type=str, help='Target language, either "javascript" or "python". Defaults to the latter.')
	
	args = vars(parser.parse_args())
	#Set verbose
	if args['verbose'] is not None:
		if args['verbose'] in [-1, 0,1,2] :
			Logger.verbose = args['verbose']
		else :
			Logger.showError("Invalid verbose argument.")
	else :
		Logger.verbose = 2

	#Set source file
	source = args['input']
	if not source.endswith(".xml") :
		Logger.showError("Input file not valid.")
		return
	
	#Set target language
	if args['language'] :
		target_language = args['language']
	else :
		target_language = ""

	#Set output file
	if args['output'] :
		output = args['output']
	else:
		output = os.path.splitext(os.path.split(source)[1])[0]
		
	#Set platform	
	if args['platform'] :
		args['platform'] = args['platform'].lower()
		if args['platform'] == "threads" :
			platform = Platforms.Threads
		elif args['platform'] == "gameloop" :
			platform = Platforms.GameLoop
		elif args['platform'] == "eventloop" :
			platform = Platforms.EventLoop
		else :
			Logger.showError("Invalid platform.")
			return		  
	else :
		platform = Platforms.EventLoop
		
	#Compile	
	try :
		generate(source, output, target_language, platform)
	except CompilerException as exception :
		Logger.showError(str(exception));
		return 1

	return 0

if __name__ == "__main__":
	sys.exit(main())


